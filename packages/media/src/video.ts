/**
 * Video perceptual fingerprint — a sequence of per-frame dHashes.
 *
 * The fingerprint is the ordered list of frame dHashes. Matching is by
 * CONTAINMENT: what fraction of one clip's frames have a near-duplicate frame in
 * another. This survives re-encoding, resizing and brightness (each frame's dHash
 * does), and tolerates clip subsetting, extra frames and mild re-timing (frames
 * are matched set-wise, not positionally).
 *
 * SCOPE (docs/LIMITATIONS.md): input is a sequence of already-extracted frames
 * (RawImage). Demuxing/decoding a real container/codec (MP4/H.264/…) into frames
 * is NOT implemented — extract keyframes first. Heavy crop/rotation defeat dHash.
 */

import { dHash } from './perceptual.ts';
import type { Fingerprint } from './perceptual.ts';
import type { RawImage } from './png.ts';

const ALGO = 'framehash-dhash-v1';
const POP = Array.from({ length: 16 }, (_, i) => (i.toString(2).match(/1/g) ?? []).length);

export function videoFingerprint(frames: RawImage[]): Fingerprint {
  return { algo: ALGO, value: frames.map((f) => dHash(f).value).join('|') };
}

function frameHashes(fp: Fingerprint): string[] {
  return fp.value ? fp.value.split('|') : [];
}

function hammingHex(a: string, b: string): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let d = 0;
  for (let i = 0; i < a.length; i++) d += POP[(parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16)) & 0xf]!;
  return d;
}

/** Fraction of `a`'s frames that have a near-duplicate (≤maxHamming) in `b`. */
export function videoContainment(a: Fingerprint, b: Fingerprint, maxHamming = 10): number {
  if (a.algo !== b.algo) return 0;
  const fa = frameHashes(a);
  const fb = frameHashes(b);
  if (fa.length === 0) return 0;
  let hit = 0;
  for (const ha of fa) {
    for (const hb of fb) {
      if (hammingHex(ha, hb) <= maxHamming) {
        hit++;
        break;
      }
    }
  }
  return hit / fa.length;
}

/** Symmetric similarity (min of both containments) — for "same video" checks. */
export function videoSimilarity(a: Fingerprint, b: Fingerprint, maxHamming = 10): number {
  return Math.min(videoContainment(a, b, maxHamming), videoContainment(b, a, maxHamming));
}

export { ALGO as VIDEO_ALGO };
