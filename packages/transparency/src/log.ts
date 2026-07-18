/**
 * Verifiable transparency log.
 *
 * An append-only Merkle log of arbitrary entries. The log can issue:
 *   - signed checkpoints (a tree head: size + root, signed by the log's key) so
 *     third parties can detect tampering they were never shown;
 *   - inclusion proofs (an entry is in the log at a checkpoint);
 *   - consistency proofs (a newer checkpoint is an append-only extension of an
 *     older one — history was never rewritten).
 *
 * This closes the gap the plain audit log left open: audit.ts is tamper-evident
 * only within one instance; here the head is published and independently
 * verifiable, and append-only-ness is provable between any two checkpoints.
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
import {
  leafHash,
  merkleRoot,
  inclusionProof,
  verifyInclusion,
  consistencyProof,
  verifyConsistency,
} from './merkle.ts';

export interface Checkpoint {
  logId: string;
  size: number;
  rootHash: string; // hex
}
export interface SignedCheckpoint extends Checkpoint {
  signer: SignerRef;
  signature: string;
}

export interface InclusionProofResult {
  logId: string;
  index: number;
  size: number;
  leafHash: string; // hex
  rootHash: string; // hex
  proof: string[]; // hex
}

export interface ConsistencyProofResult {
  logId: string;
  oldSize: number;
  newSize: number;
  oldRoot: string; // hex
  newRoot: string; // hex
  proof: string[]; // hex
}

const hex = (b: Buffer) => b.toString('hex');
const unhex = (s: string) => Buffer.from(s, 'hex');

export class TransparencyLog {
  #leaves: Buffer[] = [];
  #logId: string;

  constructor(logId = 'origentra-log/1') {
    this.#logId = logId;
  }

  get logId(): string {
    return this.#logId;
  }
  get size(): number {
    return this.#leaves.length;
  }

  append(data: Buffer | Uint8Array | string): { index: number; size: number } {
    this.#leaves.push(leafHash(data));
    return { index: this.#leaves.length - 1, size: this.#leaves.length };
  }

  root(): Buffer {
    return merkleRoot(this.#leaves);
  }

  checkpoint(signerKey: KeyPair): SignedCheckpoint {
    const body: Checkpoint = { logId: this.#logId, size: this.size, rootHash: hex(this.root()) };
    return { ...body, signer: signerRef(signerKey), signature: sign(signerKey.privateKeyPem, canonicalBytes(body)) };
  }

  inclusionProof(index: number): InclusionProofResult {
    const proof = inclusionProof(index, this.#leaves);
    return {
      logId: this.#logId,
      index,
      size: this.size,
      leafHash: hex(this.#leaves[index]!),
      rootHash: hex(this.root()),
      proof: proof.map(hex),
    };
  }

  consistencyProof(oldSize: number): ConsistencyProofResult {
    const proof = consistencyProof(oldSize, this.#leaves);
    return {
      logId: this.#logId,
      oldSize,
      newSize: this.size,
      oldRoot: hex(merkleRoot(this.#leaves.slice(0, oldSize))),
      newRoot: hex(this.root()),
      proof: proof.map(hex),
    };
  }
}

/** A checkpoint is trustworthy only if signed by a trusted key. */
export function verifyCheckpoint(cp: SignedCheckpoint, trust: TrustStore): boolean {
  const { signer, signature, ...body } = cp;
  return trust.has(signer.keyId) && verifySig(signer.publicKeyPem, canonicalBytes(body), signature);
}

export function verifyInclusionResult(r: InclusionProofResult): boolean {
  return verifyInclusion(unhex(r.leafHash), r.index, r.size, r.proof.map(unhex), unhex(r.rootHash));
}

export function verifyConsistencyResult(r: ConsistencyProofResult): boolean {
  return verifyConsistency(r.oldSize, unhex(r.oldRoot), r.newSize, unhex(r.newRoot), r.proof.map(unhex));
}
