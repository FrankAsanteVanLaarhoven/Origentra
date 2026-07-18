/**
 * In-memory passport store with layered provenance recovery.
 *
 * Recovery strategy, in order of strength:
 *   1. Exact digest match  -> PROVENANCE_RECOVERED (byte-identical copy).
 *   2. Fuzzy fingerprint match above threshold -> candidate for recovery
 *      (transformed copy). The verifier still decides PROVENANCE vs MODIFIED.
 *
 * This is a reference store. Production uses a durable append-only manifest
 * store plus a fingerprint index; the interface here is what a public verifier
 * queries. Raw asset bytes are never stored — only manifests and fingerprints.
 */

import { sha256 } from './digest.ts';
import { fingerprint as makeFingerprint, similarity } from './fingerprint.ts';
import type { Passport } from './types.ts';

export interface FuzzyMatch {
  passport: Passport;
  score: number;
}

export class PassportStore {
  private readonly byDigest = new Map<string, Passport>();
  private readonly all: Passport[] = [];

  put(passport: Passport): this {
    this.byDigest.set(passport.manifest.digest, passport);
    this.all.push(passport);
    return this;
  }

  /** Exact recovery: byte-identical copy. */
  getByDigest(bytes: Buffer | Uint8Array | string): Passport | undefined {
    return this.byDigest.get(sha256(bytes));
  }

  /** Fuzzy recovery: best fingerprint match at or above `threshold`. */
  findByFingerprint(
    bytes: Buffer | Uint8Array | string,
    threshold = 0.6,
  ): FuzzyMatch | undefined {
    const fp = makeFingerprint(bytes);
    let best: FuzzyMatch | undefined;
    for (const p of this.all) {
      const score = Math.max(0, ...p.manifest.fingerprints.map((m) => similarity(fp, m)));
      if (score >= threshold && (!best || score > best.score)) best = { passport: p, score };
    }
    return best;
  }

  /** Recover a passport by exact digest, falling back to fuzzy match. */
  recover(
    bytes: Buffer | Uint8Array | string,
    threshold = 0.6,
  ): { passport: Passport; exact: boolean; score: number } | undefined {
    const exact = this.getByDigest(bytes);
    if (exact) return { passport: exact, exact: true, score: 1 };
    const fuzzy = this.findByFingerprint(bytes, threshold);
    if (fuzzy) return { passport: fuzzy.passport, exact: false, score: fuzzy.score };
    return undefined;
  }

  get size(): number {
    return this.all.length;
  }
}
