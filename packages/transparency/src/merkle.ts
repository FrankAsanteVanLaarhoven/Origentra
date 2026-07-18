/**
 * RFC 6962-style Merkle tree hashing and proofs.
 *
 *   leaf hash  = SHA-256(0x00 || data)
 *   node hash  = SHA-256(0x01 || left || right)
 *
 * This module provides:
 *   - the Merkle Tree Hash (root) of a list of leaves,
 *   - inclusion proofs (a leaf is in the tree) + verification,
 *   - consistency proofs (a newer tree is an append-only extension of an older
 *     one — history was never rewritten) + verification.
 *
 * Proof generation follows the RFC recursive definitions; verification uses the
 * standard iterative reconstruction. Both are validated exhaustively in tests
 * for every (index, size) and (oldSize, newSize) up to a bound.
 */

import { createHash } from 'node:crypto';

export function leafHash(data: Buffer | Uint8Array | string): Buffer {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
  return createHash('sha256').update(Buffer.concat([Buffer.from([0x00]), buf])).digest();
}

export function nodeHash(left: Buffer, right: Buffer): Buffer {
  return createHash('sha256').update(Buffer.concat([Buffer.from([0x01]), left, right])).digest();
}

/** Largest power of two strictly less than n (n >= 2). */
function splitPoint(n: number): number {
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

/** Merkle Tree Hash of a list of leaf hashes. */
export function merkleRoot(leaves: Buffer[]): Buffer {
  if (leaves.length === 0) return createHash('sha256').update(Buffer.alloc(0)).digest();
  if (leaves.length === 1) return leaves[0]!;
  const k = splitPoint(leaves.length);
  return nodeHash(merkleRoot(leaves.slice(0, k)), merkleRoot(leaves.slice(k)));
}

/** Inclusion proof for `index` within `leaves` (RFC PATH), leaf order. */
export function inclusionProof(index: number, leaves: Buffer[]): Buffer[] {
  const n = leaves.length;
  if (index < 0 || index >= n) throw new RangeError('index out of range');
  if (n === 1) return [];
  const k = splitPoint(n);
  if (index < k) return [...inclusionProof(index, leaves.slice(0, k)), merkleRoot(leaves.slice(k))];
  return [...inclusionProof(index - k, leaves.slice(k)), merkleRoot(leaves.slice(0, k))];
}

/** Reconstruct the root from a leaf + inclusion proof (inverse of PATH). */
function rootFromInclusion(index: number, size: number, leaf: Buffer, proof: Buffer[]): Buffer {
  if (size === 1) {
    if (proof.length !== 0) throw new RangeError('proof too long');
    return leaf;
  }
  if (proof.length === 0) throw new RangeError('proof too short');
  const k = splitPoint(size);
  const sibling = proof[proof.length - 1]!;
  const rest = proof.slice(0, -1);
  if (index < k) return nodeHash(rootFromInclusion(index, k, leaf, rest), sibling);
  return nodeHash(sibling, rootFromInclusion(index - k, size - k, leaf, rest));
}

export function verifyInclusion(
  leaf: Buffer,
  index: number,
  size: number,
  proof: Buffer[],
  root: Buffer,
): boolean {
  if (index < 0 || index >= size) return false;
  try {
    return rootFromInclusion(index, size, leaf, proof).equals(root);
  } catch {
    return false;
  }
}

/** Consistency proof that the first `m` leaves are a prefix of `leaves` (RFC). */
export function consistencyProof(m: number, leaves: Buffer[]): Buffer[] {
  const n = leaves.length;
  if (m < 0 || m > n) throw new RangeError('m out of range');
  if (m === 0 || m === n) return [];
  return subProof(m, leaves, true);
}

function subProof(m: number, leaves: Buffer[], b: boolean): Buffer[] {
  const n = leaves.length;
  if (m === n) return b ? [] : [merkleRoot(leaves)];
  const k = splitPoint(n);
  if (m <= k) return [...subProof(m, leaves.slice(0, k), b), merkleRoot(leaves.slice(k))];
  return [...subProof(m - k, leaves.slice(k), false), merkleRoot(leaves.slice(0, k))];
}

interface ReconState {
  old: Buffer;
  new: Buffer;
  rest: Buffer[];
}

/**
 * Reconstruct (oldRoot, newRoot) of a subtree with old-size `m`, new-size `n`,
 * mirroring subProof(). The proof is consumed from the END. When b is true and
 * m === n, the subtree root is the caller-threaded oldRoot (it is not in the
 * proof). Throws on proof underflow; verifyConsistency() catches.
 */
function reconstruct(m: number, n: number, b: boolean, proof: Buffer[], oldRoot: Buffer): ReconState {
  if (m === n) {
    if (b) return { old: oldRoot, new: oldRoot, rest: proof };
    if (proof.length === 0) throw new RangeError('proof underflow');
    const node = proof[proof.length - 1]!;
    return { old: node, new: node, rest: proof.slice(0, -1) };
  }
  if (proof.length === 0) throw new RangeError('proof underflow');
  const k = splitPoint(n);
  const sibling = proof[proof.length - 1]!;
  const rest0 = proof.slice(0, -1);
  if (m <= k) {
    // The size-m old tree lies entirely in the left subtree; right sibling given.
    const left = reconstruct(m, k, b, rest0, oldRoot);
    return { old: left.old, new: nodeHash(left.new, sibling), rest: left.rest };
  }
  // Left subtree identical in both trees (= sibling); recurse on the right, b=false.
  const right = reconstruct(m - k, n - k, false, rest0, oldRoot);
  return { old: nodeHash(sibling, right.old), new: nodeHash(sibling, right.new), rest: right.rest };
}

/**
 * Verify a consistency proof between (m, oldRoot) and (n, newRoot): that the
 * newer tree is an append-only extension of the older one (history unchanged).
 */
export function verifyConsistency(
  m: number,
  oldRoot: Buffer,
  n: number,
  newRoot: Buffer,
  proof: Buffer[],
): boolean {
  if (m > n) return false;
  if (m === n) return proof.length === 0 && oldRoot.equals(newRoot);
  if (m === 0) return proof.length === 0;
  try {
    const r = reconstruct(m, n, true, proof, oldRoot);
    return r.rest.length === 0 && r.old.equals(oldRoot) && r.new.equals(newRoot);
  } catch {
    return false;
  }
}
