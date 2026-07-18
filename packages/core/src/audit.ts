/**
 * Tamper-evident audit log (append-only hash chain).
 *
 * Every material action in the control loop is appended here. Each entry binds
 * to the previous entry's hash, so any modification, insertion or deletion of a
 * historical entry breaks the chain and is detected by verify(). This is the
 * reference transparency-log primitive; a production deployment periodically
 * publishes the head hash (and may anchor it externally) so third parties can
 * detect tampering they were not shown.
 *
 * The clock is injected so the log is deterministic under test.
 */

import { digestObject } from './digest.ts';

export const GENESIS_HASH = '0'.repeat(64);

export interface AuditEntry {
  seq: number;
  at: string;
  actor: string;
  action: string;
  subject: string;
  payloadDigest: string;
  prevHash: string;
  entryHash: string;
}

function hashOf(entry: Omit<AuditEntry, 'entryHash'>): string {
  // digestObject returns `sha256:<hex>`; store the hex tail as the chain hash.
  return digestObject(entry).slice('sha256:'.length);
}

export class AuditLog {
  private readonly entries: AuditEntry[] = [];
  private readonly now: () => string;

  constructor(now: () => string = () => new Date().toISOString()) {
    this.now = now;
  }

  append(actor: string, action: string, subject: string, payload: unknown): AuditEntry {
    const prev = this.entries[this.entries.length - 1];
    const base: Omit<AuditEntry, 'entryHash'> = {
      seq: this.entries.length,
      at: this.now(),
      actor,
      action,
      subject,
      payloadDigest: digestObject(payload),
      prevHash: prev ? prev.entryHash : GENESIS_HASH,
    };
    const entry: AuditEntry = { ...base, entryHash: hashOf(base) };
    this.entries.push(entry);
    return entry;
  }

  list(): readonly AuditEntry[] {
    return this.entries;
  }

  get head(): string {
    const last = this.entries[this.entries.length - 1];
    return last ? last.entryHash : GENESIS_HASH;
  }

  /** Recompute the chain and report the first index where it breaks, if any. */
  verify(): { ok: boolean; brokenAt?: number } {
    let prevHash = GENESIS_HASH;
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i]!;
      if (e.seq !== i || e.prevHash !== prevHash) return { ok: false, brokenAt: i };
      const { entryHash, ...base } = e;
      if (hashOf(base) !== entryHash) return { ok: false, brokenAt: i };
      prevHash = e.entryHash;
    }
    return { ok: true };
  }
}
