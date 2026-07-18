/**
 * Durable, tenant-isolated passport store (append-only JSONL on disk).
 *
 * Persistence is a single append-only file; the in-memory indexes are rebuilt
 * on construction. This is the reference durable store — a production system
 * uses PostgreSQL with row-level security, but the ISOLATION CONTRACT is the
 * same and is enforced here:
 *
 *   - getByDigest(digest) is public: you must already hold the exact bytes to
 *     know the digest, so returning that asset's passport leaks nothing new.
 *   - recover(bytes, tenantId) — fuzzy/scan recovery — is TENANT-SCOPED: it only
 *     searches passports belonging to `tenantId`. One tenant can never enumerate
 *     or fuzzy-match against another tenant's assets. Passing a tenantId that
 *     owns nothing returns undefined; there is no cross-tenant scan path.
 *
 * Raw asset bytes are never stored here — only manifests (which contain digests
 * and fingerprints).
 */

import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { sha256 } from '../../core/src/index.ts';
import { fingerprint as cdcFingerprint, similarity } from '../../core/src/index.ts';
import type { Passport } from '../../core/src/index.ts';

export interface RecoverResult {
  passport: Passport;
  exact: boolean;
  score: number;
}

export class DurableManifestStore {
  private readonly file: string;
  private readonly byDigest = new Map<string, Passport>();
  private readonly byTenant = new Map<string, Passport[]>();

  constructor(file: string) {
    this.file = file;
    if (existsSync(file)) this.load();
    else mkdirSync(dirname(file), { recursive: true });
  }

  private load(): void {
    const text = readFileSync(this.file, 'utf8');
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      this.index(JSON.parse(line) as Passport);
    }
  }

  private index(p: Passport): void {
    this.byDigest.set(p.manifest.digest, p);
    const list = this.byTenant.get(p.manifest.tenantId) ?? [];
    list.push(p);
    this.byTenant.set(p.manifest.tenantId, list);
  }

  put(passport: Passport): this {
    appendFileSync(this.file, JSON.stringify(passport) + '\n');
    this.index(passport);
    return this;
  }

  /** Public: exact recovery by the bytes' digest. */
  getByDigest(bytes: Buffer | Uint8Array | string): Passport | undefined {
    return this.byDigest.get(sha256(bytes));
  }

  /**
   * Tenant-scoped recovery: exact digest first, then fuzzy fingerprint — but
   * ONLY within `tenantId`'s own assets. Enforces cross-tenant isolation.
   */
  recover(
    bytes: Buffer | Uint8Array | string,
    tenantId: string,
    threshold = 0.6,
  ): RecoverResult | undefined {
    const own = this.byTenant.get(tenantId) ?? [];
    const digest = sha256(bytes);
    const exact = own.find((p) => p.manifest.digest === digest);
    if (exact) return { passport: exact, exact: true, score: 1 };

    const fp = cdcFingerprint(bytes);
    let best: RecoverResult | undefined;
    for (const p of own) {
      const score = Math.max(
        0,
        ...p.manifest.fingerprints
          .filter((m) => m.algo === fp.algo)
          .map((m) => similarity(fp, m)),
      );
      if (score >= threshold && (!best || score > best.score)) {
        best = { passport: p, exact: false, score };
      }
    }
    return best;
  }

  countForTenant(tenantId: string): number {
    return (this.byTenant.get(tenantId) ?? []).length;
  }

  get size(): number {
    return this.byDigest.size;
  }
}
