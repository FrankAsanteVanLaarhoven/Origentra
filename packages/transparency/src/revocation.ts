/**
 * Revocation registry, backed by a transparency log.
 *
 * A revocation is a signed statement that a passport or identity is no longer
 * valid. It is honoured ONLY when signed by a trusted key (e.g. the original
 * signer or the tenant authority), and every accepted revocation is appended to
 * a transparency log so revocations are themselves append-only and provable.
 *
 * A public verifier consults `isRevoked` and emits CREDENTIAL_REVOKED — so a
 * passport can be revoked after issuance and every verifier learns, even when
 * the presented passport object itself is not marked revoked.
 */

import {
  canonicalBytes,
  sign,
  verify as verifySig,
  signerRef,
  type KeyPair,
  type SignerRef,
  type TrustStore,
} from '../../core/src/index.ts';
import { TransparencyLog } from './log.ts';

export interface RevocationTarget {
  type: 'passport' | 'identity';
  /** Passport digest (`sha256:…`) or identity id. */
  id: string;
}

export interface RevocationEntry {
  target: RevocationTarget;
  reason: string;
  revokedAt: string;
  signer: SignerRef;
  signature: string;
}

export function signRevocation(
  target: RevocationTarget,
  reason: string,
  revokedAt: string,
  key: KeyPair,
): RevocationEntry {
  const body = { target, reason, revokedAt };
  return { ...body, signer: signerRef(key), signature: sign(key.privateKeyPem, canonicalBytes(body)) };
}

export function verifyRevocation(entry: RevocationEntry, trust: TrustStore): boolean {
  const { signer, signature, ...body } = entry;
  return trust.has(signer.keyId) && verifySig(signer.publicKeyPem, canonicalBytes(body), signature);
}

export class RevocationRegistry {
  #trust: TrustStore;
  #log: TransparencyLog;
  #index = new Map<string, RevocationEntry>();

  constructor(trust: TrustStore, log = new TransparencyLog('origentra-revocations/1')) {
    this.#trust = trust;
    this.#log = log;
  }

  get log(): TransparencyLog {
    return this.#log;
  }
  get size(): number {
    return this.#index.size;
  }

  #key(type: string, id: string): string {
    return `${type}:${id}`;
  }

  /** Accept a revocation only if it is validly signed by a trusted key. */
  add(entry: RevocationEntry): { accepted: boolean; index?: number } {
    if (!verifyRevocation(entry, this.#trust)) return { accepted: false };
    const { index } = this.#log.append(canonicalBytes(entry));
    this.#index.set(this.#key(entry.target.type, entry.target.id), entry);
    return { accepted: true, index };
  }

  revoke(
    target: RevocationTarget,
    reason: string,
    revokedAt: string,
    key: KeyPair,
  ): { entry: RevocationEntry; accepted: boolean; index?: number } {
    const entry = signRevocation(target, reason, revokedAt, key);
    return { entry, ...this.add(entry) };
  }

  isRevoked(type: RevocationTarget['type'], id: string): boolean {
    return this.#index.has(this.#key(type, id));
  }

  entry(type: RevocationTarget['type'], id: string): RevocationEntry | undefined {
    return this.#index.get(this.#key(type, id));
  }

  /** Build a registry from serialised revocation entries (e.g. a JSONL file). */
  static fromEntries(entries: RevocationEntry[], trust: TrustStore): RevocationRegistry {
    const reg = new RevocationRegistry(trust);
    for (const e of entries) reg.add(e);
    return reg;
  }

  static fromJSONL(text: string, trust: TrustStore): RevocationRegistry {
    const entries: RevocationEntry[] = [];
    for (const line of text.split('\n')) if (line.trim()) entries.push(JSON.parse(line) as RevocationEntry);
    return RevocationRegistry.fromEntries(entries, trust);
  }
}
