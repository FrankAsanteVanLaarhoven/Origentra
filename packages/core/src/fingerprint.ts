/**
 * Fuzzy content fingerprinting for provenance survivability.
 *
 * An exact digest (digest.ts) only recovers provenance for byte-identical
 * copies. To recover provenance after a transformation, we need a fingerprint
 * that changes *gradually* as the content changes.
 *
 * This module implements a content-defined chunking (CDC) fingerprint using a
 * gear rolling hash — the same family of technique used by rsync/FastCDC. The
 * asset is split into content-defined chunks; each chunk is mini-hashed; the
 * fingerprint is the set of chunk mini-hashes. Similarity is the Jaccard index
 * of two such sets. Because chunk boundaries are content-defined, inserting,
 * deleting or editing part of an asset only changes the chunks it touches, so
 * similarity degrades gracefully rather than collapsing to zero.
 *
 * SCOPE / LIMITATION (see docs/LIMITATIONS.md): CDC fingerprints are robust to
 * byte-level edits, truncation, insertion and re-ordering of embedded data. They
 * are NOT a substitute for domain-specific perceptual hashing (pHash for images,
 * chromaprint for audio, frame-hash sequences for video), which survive
 * re-encoding and resampling that change every byte. Those are a later milestone;
 * this primitive is honest about what it does and does not cover.
 */

import { createHash } from 'node:crypto';
import type { Fingerprint } from './types.ts';

const ALGO = 'cdc-gear-v1';

// Deterministic 256-entry gear table derived from a fixed seed via splitmix64,
// so every conforming implementation produces identical fingerprints.
const GEAR: Uint32Array = buildGearTable(0x9e3779b97f4a7c15n);

function buildGearTable(seed: bigint): Uint32Array {
  const table = new Uint32Array(256);
  let x = seed & 0xffffffffffffffffn;
  for (let i = 0; i < 256; i++) {
    // splitmix64 step
    x = (x + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = x;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    z = z ^ (z >> 31n);
    table[i] = Number(z & 0xffffffffn) >>> 0;
  }
  return table;
}

export interface ChunkParams {
  /** Average target chunk size is ~2^maskBits bytes. */
  maskBits: number;
  minChunk: number;
  maxChunk: number;
}

const DEFAULTS: ChunkParams = { maskBits: 5, minChunk: 8, maxChunk: 512 };

/** Split bytes into content-defined chunks and return their mini-hashes. */
function chunkMiniHashes(bytes: Buffer, params: ChunkParams): string[] {
  const { maskBits, minChunk, maxChunk } = params;
  const mask = (1 << maskBits) - 1;
  const hashes: string[] = [];
  let start = 0;
  let gear = 0;
  for (let i = 0; i < bytes.length; i++) {
    gear = (((gear << 1) >>> 0) + GEAR[bytes[i]!]!) >>> 0;
    const len = i - start + 1;
    const boundary = len >= minChunk && (gear & mask) === 0;
    if (boundary || len >= maxChunk || i === bytes.length - 1) {
      const chunk = bytes.subarray(start, i + 1);
      hashes.push(createHash('sha256').update(chunk).digest('hex').slice(0, 12));
      start = i + 1;
      gear = 0;
    }
  }
  return hashes;
}

export function fingerprint(
  bytes: Buffer | Uint8Array | string,
  params: ChunkParams = DEFAULTS,
): Fingerprint {
  const buf = typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : Buffer.from(bytes);
  const hashes = chunkMiniHashes(buf, params);
  // The value encodes the multiset of chunk hashes; order-independent by design.
  const sorted = [...hashes].sort();
  return { algo: ALGO, value: sorted.join('.') };
}

function toCounts(fp: Fingerprint): Map<string, number> {
  const counts = new Map<string, number>();
  if (!fp.value.length) return counts;
  for (const h of fp.value.split('.')) counts.set(h, (counts.get(h) ?? 0) + 1);
  return counts;
}

/**
 * Weighted (multiset) Jaccard similarity in [0,1] between two fingerprints of
 * the same algorithm. Multiplicity is preserved so that highly repetitive
 * content is compared correctly: intersection is the sum of per-chunk minima,
 * union the sum of per-chunk maxima. Returns 0 for mismatched algorithms.
 */
export function similarity(a: Fingerprint, b: Fingerprint): number {
  if (a.algo !== b.algo) return 0;
  const ca = toCounts(a);
  const cb = toCounts(b);
  if (ca.size === 0 && cb.size === 0) return 1;
  const keys = new Set([...ca.keys(), ...cb.keys()]);
  let inter = 0;
  let union = 0;
  for (const k of keys) {
    const x = ca.get(k) ?? 0;
    const y = cb.get(k) ?? 0;
    inter += Math.min(x, y);
    union += Math.max(x, y);
  }
  return union === 0 ? 0 : inter / union;
}

export { ALGO as FINGERPRINT_ALGO, DEFAULTS as FINGERPRINT_DEFAULTS };
