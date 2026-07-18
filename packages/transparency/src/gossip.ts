/**
 * Witness gossip: distributing checkpoints to witnesses and auditing for splits.
 *
 * `WitnessTransport` abstracts talking to a witness (in-process or over HTTP), so
 * the distribution and audit logic is transport-agnostic and testable without a
 * network. `distributeCheckpoint` pushes a checkpoint to a set of witnesses —
 * supplying each the right consistency proof from its own last-seen size — and
 * collects the cosignatures into a WitnessedCheckpoint. `auditSplitView` queries
 * each witness's latest view and flags a fork if any two witnesses hold the same
 * size with different roots — i.e. the log showed them different heads.
 */

import { Witness, type CosignResult, type WitnessedCheckpoint } from './witness.ts';
import type { SignedCheckpoint, ConsistencyProofResult } from './log.ts';

export interface WitnessView {
  size: number;
  rootHash: string;
}

export interface WitnessTransport {
  readonly keyId: string;
  cosign(checkpoint: SignedCheckpoint, consistencyProof?: ConsistencyProofResult): Promise<CosignResult>;
  latest(logId: string): Promise<WitnessView | null>;
}

/** In-process transport wrapping a Witness directly (single process / tests). */
export class LocalWitnessTransport implements WitnessTransport {
  #witness: Witness;
  readonly keyId: string;

  constructor(witness: Witness) {
    this.#witness = witness;
    this.keyId = witness.keyId;
  }

  async cosign(cp: SignedCheckpoint, proof?: ConsistencyProofResult): Promise<CosignResult> {
    return this.#witness.cosign(cp, proof);
  }

  async latest(logId: string): Promise<WitnessView | null> {
    return this.#witness.lastSeen(logId) ?? null;
  }
}

export interface DistributeResult {
  witnessed: WitnessedCheckpoint;
  accepted: number;
  refusals: { keyId: string; reason: string }[];
}

/**
 * Submit a checkpoint to every witness, giving each the consistency proof from
 * ITS own last-seen size (via `proofFor`, backed by the log). Returns the
 * assembled WitnessedCheckpoint plus which witnesses refused and why.
 */
export async function distributeCheckpoint(
  checkpoint: SignedCheckpoint,
  proofFor: (oldSize: number) => ConsistencyProofResult | undefined,
  transports: WitnessTransport[],
): Promise<DistributeResult> {
  const cosignatures = [];
  const refusals: { keyId: string; reason: string }[] = [];
  for (const t of transports) {
    const last = await t.latest(checkpoint.logId);
    const proof = last && last.size < checkpoint.size ? proofFor(last.size) : undefined;
    const res = await t.cosign(checkpoint, proof);
    if (res.accepted && res.cosignature) cosignatures.push(res.cosignature);
    else refusals.push({ keyId: t.keyId, reason: res.reason ?? 'refused' });
  }
  return { witnessed: { checkpoint, cosignatures }, accepted: cosignatures.length, refusals };
}

export interface AuditView {
  keyId: string;
  view: WitnessView | null;
}
export interface AuditResult {
  forked: boolean;
  views: AuditView[];
  evidence?: { a: AuditView; b: AuditView };
}

/**
 * Query every witness's latest view of a log and detect a split view: two
 * witnesses at the same size with different roots is proof the log forked.
 */
export async function auditSplitView(
  logId: string,
  transports: WitnessTransport[],
): Promise<AuditResult> {
  const views: AuditView[] = [];
  for (const t of transports) views.push({ keyId: t.keyId, view: await t.latest(logId) });

  const firstAtSize = new Map<number, AuditView>();
  for (const v of views) {
    if (!v.view) continue;
    const prev = firstAtSize.get(v.view.size);
    if (prev && prev.view!.rootHash !== v.view.rootHash) {
      return { forked: true, views, evidence: { a: prev, b: v } };
    }
    if (!prev) firstAtSize.set(v.view.size, v);
  }
  return { forked: false, views };
}
