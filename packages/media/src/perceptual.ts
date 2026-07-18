/**
 * Perceptual image fingerprint (dHash) for provenance survivability.
 *
 * Unlike an exact digest or the byte-level CDC fingerprint, a perceptual hash
 * tracks how an image *looks*, so it survives transformations that change every
 * byte while preserving appearance: re-encoding, resizing, mild recompression
 * and brightness/contrast shifts. dHash encodes the sign of the horizontal
 * brightness gradient on a small greyscale grid, which is inherently robust to
 * global brightness change and scale.
 *
 * Output is a `Fingerprint { algo: 'dhash-8x8-v1', value: <16 hex chars> }` so
 * it drops straight into a Content Passport alongside the CDC fingerprint. A
 * verifier compares two perceptual fingerprints with `perceptualSimilarity`.
 *
 * LIMITATION: dHash is robust to the transformations above but not to heavy
 * crop, rotation or flips (those change the gradient layout). It is a screening
 * signal with calibrated thresholds, not proof of identity — see docs.
 */

import type { RawImage } from './png.ts';

const HASH = 8; // 8x8 grid -> 64 bits
const ALGO = 'dhash-8x8-v1';

export interface Fingerprint {
  algo: string;
  value: string;
}

export function toGrayscale(img: RawImage): Uint8Array {
  const { width, height, channels, data } = img;
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    if (channels >= 3) {
      gray[i] = Math.round(0.299 * data[o]! + 0.587 * data[o + 1]! + 0.114 * data[o + 2]!);
    } else {
      gray[i] = data[o]!; // grey or grey+alpha
    }
  }
  return gray;
}

/** Box-average resample of a greyscale plane to (tw x th). */
export function resizeGray(
  src: Uint8Array,
  sw: number,
  sh: number,
  tw: number,
  th: number,
): Uint8Array {
  const out = new Uint8Array(tw * th);
  for (let ty = 0; ty < th; ty++) {
    const y0 = Math.floor((ty * sh) / th);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * sh) / th));
    for (let tx = 0; tx < tw; tx++) {
      const x0 = Math.floor((tx * sw) / tw);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * sw) / tw));
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          sum += src[y * sw + x]!;
          n++;
        }
      }
      out[ty * tw + tx] = Math.round(sum / n);
    }
  }
  return out;
}

export function dHash(img: RawImage): Fingerprint {
  const gray = toGrayscale(img);
  // Resize to (HASH+1) x HASH so each row yields HASH horizontal comparisons.
  const small = resizeGray(gray, img.width, img.height, HASH + 1, HASH);
  let bits = '';
  for (let y = 0; y < HASH; y++) {
    for (let x = 0; x < HASH; x++) {
      bits += small[y * (HASH + 1) + x]! < small[y * (HASH + 1) + x + 1]! ? '1' : '0';
    }
  }
  // Pack 64 bits into 16 hex chars.
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return { algo: ALGO, value: hex };
}

const POP = Array.from({ length: 16 }, (_, i) => (i.toString(2).match(/1/g) ?? []).length);

/** Hamming distance (in bits) between two dHash values. */
export function hammingDistance(a: Fingerprint, b: Fingerprint): number {
  if (a.algo !== b.algo || a.value.length !== b.value.length) return Number.POSITIVE_INFINITY;
  let d = 0;
  for (let i = 0; i < a.value.length; i++) {
    d += POP[(parseInt(a.value[i]!, 16) ^ parseInt(b.value[i]!, 16)) & 0xf]!;
  }
  return d;
}

/** Similarity in [0,1]: 1 - hamming/64. */
export function perceptualSimilarity(a: Fingerprint, b: Fingerprint): number {
  const d = hammingDistance(a, b);
  return Number.isFinite(d) ? 1 - d / 64 : 0;
}

export { ALGO as PERCEPTUAL_ALGO, HASH as PERCEPTUAL_GRID };
