/**
 * Enrolment registry — the consent gate for biometric detection.
 *
 * A reference biometric fingerprint (perceptual hash of a face/voice — never raw
 * media) is stored ENCRYPTED under customer-managed keys (CMK envelope
 * encryption). A detector can obtain the reference ONLY while the subject's
 * consent for that modality is active. Withdrawal is a signed statement that
 * CRYPTO-SHREDS the encrypted reference (destroying the ciphertext and its wrapped
 * data key, leaving no plaintext copy) and blocks further use. Every consent,
 * enrolment and withdrawal is transparency-logged.
 *
 * This is the code form of the Article 9 privacy-by-design gate: enrolment-gated,
 * consent-gated, hash-only, and reversible by the subject at any time.
 */

import { canonicalBytes } from '../../core/src/index.ts';
import { encrypt, decrypt, type KeyProvider, type Envelope } from '../../enterprise/src/index.ts';
import { TransparencyLog } from '../../transparency/src/index.ts';
import type { Fingerprint } from '../../media/src/index.ts';
import { verifyConsent, verifyWithdrawal, consentCoversModality } from './consent.ts';
import type { EnrolmentConsent, ConsentWithdrawal, ConsentModality } from './types.ts';

interface StoredConsent {
  consent: EnrolmentConsent;
  withdrawnModalities: Set<ConsentModality>;
  withdrawnAt?: string;
}
interface StoredEnrolment {
  enrolmentId: string;
  subjectId: string;
  modality: ConsentModality;
  reference?: Envelope; // undefined after crypto-shred
  status: 'active' | 'withdrawn';
  enrolledAt: string;
  withdrawnAt?: string;
}

export interface EnrolmentRegistryOptions {
  now: () => string;
  log?: TransparencyLog;
}

export interface ActiveReference {
  subjectId: string;
  enrolmentId: string;
  fingerprint: Fingerprint;
}

export class EnrolmentRegistry {
  #kms: KeyProvider;
  #now: () => string;
  #log: TransparencyLog;
  #consents = new Map<string, StoredConsent>();
  #enrolments = new Map<string, StoredEnrolment>();
  #bySubject = new Map<string, Set<string>>();
  #counter = 0;

  constructor(kms: KeyProvider, opts: EnrolmentRegistryOptions) {
    this.#kms = kms;
    this.#now = opts.now;
    this.#log = opts.log ?? new TransparencyLog('origentra-enrolment/1');
  }

  get log(): TransparencyLog {
    return this.#log;
  }

  recordConsent(consent: EnrolmentConsent): { accepted: boolean; reason?: string } {
    if (!verifyConsent(consent)) return { accepted: false, reason: 'invalid_signature' };
    this.#consents.set(consent.subjectId, { consent, withdrawnModalities: new Set() });
    this.#log.append(canonicalBytes({ t: 'consent', subjectId: consent.subjectId, modalities: consent.modalities, at: consent.consentedAt, notice: consent.noticeVersion }));
    return { accepted: true };
  }

  #consentActive(subjectId: string, modality: ConsentModality): boolean {
    const sc = this.#consents.get(subjectId);
    if (!sc || sc.withdrawnModalities.has(modality)) return false;
    return consentCoversModality(sc.consent, modality, this.#now());
  }

  hasActiveConsent(subjectId: string, modality: ConsentModality): boolean {
    return this.#consentActive(subjectId, modality);
  }

  /** Enrol a reference — only permitted while consent for the modality is active. */
  enrol(subjectId: string, modality: ConsentModality, reference: Fingerprint): { accepted: boolean; enrolmentId?: string; reason?: string } {
    if (!this.#consentActive(subjectId, modality)) return { accepted: false, reason: 'no_active_consent' };
    const enrolmentId = `enr-${++this.#counter}`;
    const at = this.#now();
    const envelope = encrypt(JSON.stringify(reference), this.#kms);
    this.#enrolments.set(enrolmentId, { enrolmentId, subjectId, modality, reference: envelope, status: 'active', enrolledAt: at });
    const set = this.#bySubject.get(subjectId) ?? new Set<string>();
    set.add(enrolmentId);
    this.#bySubject.set(subjectId, set);
    this.#log.append(canonicalBytes({ t: 'enrol', enrolmentId, subjectId, modality, at }));
    return { accepted: true, enrolmentId };
  }

  /** Withdraw consent (signed by the subject) — crypto-shreds matching enrolments. */
  withdraw(w: ConsentWithdrawal): { accepted: boolean; reason?: string; shredded: number } {
    if (!verifyWithdrawal(w)) return { accepted: false, reason: 'invalid_signature', shredded: 0 };
    const sc = this.#consents.get(w.subjectId);
    if (!sc) return { accepted: false, reason: 'no_consent', shredded: 0 };
    if (w.signer.keyId !== sc.consent.signer.keyId) return { accepted: false, reason: 'withdrawal_key_mismatch', shredded: 0 };

    for (const m of w.modalities) sc.withdrawnModalities.add(m);
    sc.withdrawnAt = w.withdrawnAt;

    let shredded = 0;
    for (const enrolmentId of this.#bySubject.get(w.subjectId) ?? []) {
      const e = this.#enrolments.get(enrolmentId)!;
      if (e.status === 'active' && w.modalities.includes(e.modality)) {
        e.reference = undefined; // CRYPTO-SHRED: ciphertext + wrapped DEK destroyed
        e.status = 'withdrawn';
        e.withdrawnAt = w.withdrawnAt;
        shredded++;
      }
    }
    this.#log.append(canonicalBytes({ t: 'withdraw', subjectId: w.subjectId, modalities: w.modalities, at: w.withdrawnAt, shredded }));
    return { accepted: true, shredded };
  }

  /** The reference — available ONLY while consent is active and not shredded. */
  referenceFor(enrolmentId: string): Fingerprint | undefined {
    const e = this.#enrolments.get(enrolmentId);
    if (!e || e.status !== 'active' || !e.reference) return undefined;
    if (!this.#consentActive(e.subjectId, e.modality)) return undefined;
    return JSON.parse(decrypt(e.reference, this.#kms).toString('utf8')) as Fingerprint;
  }

  /** All references usable now for a modality — to build a consent-gated detector index. */
  activeReferences(modality: ConsentModality): ActiveReference[] {
    const out: ActiveReference[] = [];
    for (const e of this.#enrolments.values()) {
      if (e.modality !== modality || e.status !== 'active' || !e.reference) continue;
      if (!this.#consentActive(e.subjectId, e.modality)) continue;
      out.push({ subjectId: e.subjectId, enrolmentId: e.enrolmentId, fingerprint: JSON.parse(decrypt(e.reference, this.#kms).toString('utf8')) as Fingerprint });
    }
    return out;
  }

  /** True once the encrypted reference has been crypto-shredded. */
  isShredded(enrolmentId: string): boolean {
    const e = this.#enrolments.get(enrolmentId);
    return !!e && !e.reference;
  }
}
