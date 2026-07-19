/**
 * Signing and verification for enrolment consent and withdrawal.
 *
 * Consent and withdrawal are signed by the subject (or guardian). Withdrawal must
 * be verifiable against the SAME key that gave consent — so only the subject can
 * withdraw their own consent, and withdrawal is symmetric to consent.
 */

import {
  canonicalBytes,
  sign,
  verify as verifySig,
  signerRef,
  type KeyPair,
} from '../../core/src/index.ts';
import type { EnrolmentConsent, ConsentWithdrawal, ConsentModality } from './types.ts';

export function signConsent(
  fields: Omit<EnrolmentConsent, 'signer' | 'signature'>,
  key: KeyPair,
): EnrolmentConsent {
  if (fields.modalities.length === 0) throw new Error('consent must name at least one modality');
  if (!fields.noticeVersion.trim()) throw new Error('noticeVersion (what the subject was shown) is required');
  const body = { ...fields };
  return { ...body, signer: signerRef(key), signature: sign(key.privateKeyPem, canonicalBytes(body)) };
}

export function verifyConsent(consent: EnrolmentConsent): boolean {
  const { signer, signature, ...body } = consent;
  return verifySig(signer.publicKeyPem, canonicalBytes(body), signature);
}

export function signWithdrawal(
  fields: Omit<ConsentWithdrawal, 'signer' | 'signature'>,
  key: KeyPair,
): ConsentWithdrawal {
  const body = { ...fields };
  return { ...body, signer: signerRef(key), signature: sign(key.privateKeyPem, canonicalBytes(body)) };
}

export function verifyWithdrawal(w: ConsentWithdrawal): boolean {
  const { signer, signature, ...body } = w;
  return verifySig(signer.publicKeyPem, canonicalBytes(body), signature);
}

/** Whether a consent document covers `modality` and has not expired at `now`. */
export function consentCoversModality(
  consent: EnrolmentConsent,
  modality: ConsentModality,
  now: string,
): boolean {
  if (!consent.modalities.includes(modality)) return false;
  if (consent.expiresAt && consent.expiresAt <= now) return false;
  return true;
}
