/**
 * Distributed witnessing (checkpoint cosigning).
 *
 * A transparency log operator could otherwise fork the log and show different
 * (self-consistent) heads to different clients — a "split view". Witnesses defend
 * against this: an independent witness co-signs a checkpoint ONLY after checking
 * that it is an append-only extension of the last checkpoint that witness saw
 * (via a consistency proof). A forked or rolled-back head therefore cannot
 * collect witness cosignatures, and a client that requires K trusted
 * cosignatures will reject it. Two validly-signed checkpoints of the same size
 * with different roots are direct proof of a fork.
 *
 * This is the model used by Certificate Transparency witnesses and the Go
 * checksum database. Not implemented here: a live gossip network between
 * witnesses (see docs/LIMITATIONS.md); this provides the cosigning primitive and
 * the detection logic that such a network would carry.
 */

import {
  canonicalBytes,
  sign,
  verify as verifySig,
  type KeyPair,
  type TrustStore,
} from '../../core/src/index.ts';
import {
  verifyCheckpoint,
  verifyConsistencyResult,
  type Checkpoint,
  type SignedCheckpoint,
  type ConsistencyProofResult,
} from './log.ts';

export interface WitnessCosignature {
  witnessKeyId: string;
  publicKeyPem: string;
  logId: string;
  size: number;
  rootHash: string;
  signature: string;
}

function checkpointBody(cp: Checkpoint) {
  return { logId: cp.logId, size: cp.size, rootHash: cp.rootHash };
}

export function cosignCheckpoint(cp: Checkpoint, key: KeyPair): WitnessCosignature {
  const body = checkpointBody(cp);
  return {
    witnessKeyId: key.keyId,
    publicKeyPem: key.publicKeyPem,
    ...body,
    signature: sign(key.privateKeyPem, canonicalBytes(body)),
  };
}

export function verifyCosignature(cp: Checkpoint, cosig: WitnessCosignature): boolean {
  if (cosig.logId !== cp.logId || cosig.size !== cp.size || cosig.rootHash !== cp.rootHash) return false;
  return verifySig(cosig.publicKeyPem, canonicalBytes(checkpointBody(cp)), cosig.signature);
}

export interface CosignResult {
  accepted: boolean;
  reason?: string;
  cosignature?: WitnessCosignature;
}

/**
 * A witness holds the latest checkpoint it cosigned per logId and only cosigns a
 * strictly append-only successor (verified by a consistency proof), a re-shown
 * identical head, or a first-seen head.
 */
export class Witness {
  #key: KeyPair;
  #logTrust: TrustStore;
  #seen = new Map<string, { size: number; rootHash: string }>();

  constructor(key: KeyPair, logTrust: TrustStore) {
    this.#key = key;
    this.#logTrust = logTrust;
  }

  get keyId(): string {
    return this.#key.keyId;
  }

  lastSeen(logId: string): { size: number; rootHash: string } | undefined {
    return this.#seen.get(logId);
  }

  cosign(checkpoint: SignedCheckpoint, consistencyProof?: ConsistencyProofResult): CosignResult {
    if (!verifyCheckpoint(checkpoint, this.#logTrust)) {
      return { accepted: false, reason: 'untrusted_log_signature' };
    }
    const last = this.#seen.get(checkpoint.logId);
    if (last) {
      if (checkpoint.size < last.size) return { accepted: false, reason: 'rollback' };
      if (checkpoint.size === last.size) {
        if (checkpoint.rootHash !== last.rootHash) return { accepted: false, reason: 'fork_same_size' };
      } else {
        if (!consistencyProof) return { accepted: false, reason: 'consistency_proof_required' };
        if (
          consistencyProof.oldSize !== last.size ||
          consistencyProof.newSize !== checkpoint.size ||
          consistencyProof.oldRoot !== last.rootHash ||
          consistencyProof.newRoot !== checkpoint.rootHash
        ) {
          return { accepted: false, reason: 'consistency_proof_mismatch' };
        }
        if (!verifyConsistencyResult(consistencyProof)) {
          return { accepted: false, reason: 'inconsistent_extension' };
        }
      }
    }
    this.#seen.set(checkpoint.logId, { size: checkpoint.size, rootHash: checkpoint.rootHash });
    return { accepted: true, cosignature: cosignCheckpoint(checkpoint, this.#key) };
  }
}

export interface WitnessedCheckpoint {
  checkpoint: SignedCheckpoint;
  cosignatures: WitnessCosignature[];
}

/**
 * A witnessed checkpoint is trustworthy only if signed by a trusted log key and
 * co-signed by at least `minWitnesses` distinct trusted witnesses.
 */
export function verifyWitnessed(
  wcp: WitnessedCheckpoint,
  logTrust: TrustStore,
  witnessTrust: TrustStore,
  minWitnesses: number,
): boolean {
  if (!verifyCheckpoint(wcp.checkpoint, logTrust)) return false;
  const seen = new Set<string>();
  for (const c of wcp.cosignatures) {
    if (!witnessTrust.has(c.witnessKeyId)) continue;
    if (!verifyCosignature(wcp.checkpoint, c)) continue;
    seen.add(c.witnessKeyId);
  }
  return seen.size >= minWitnesses;
}

/** Two validly-signed checkpoints of the same size with different roots = fork. */
export function detectSplitView(a: SignedCheckpoint, b: SignedCheckpoint): boolean {
  return a.logId === b.logId && a.size === b.size && a.rootHash !== b.rootHash;
}
