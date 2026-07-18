/**
 * @origentra/media — perceptual media fingerprinting. Zero runtime dependencies
 * (node:zlib only). Produces Content-Passport-compatible Fingerprints.
 */

import { decodePng, type RawImage } from './png.ts';
import { dHash, type Fingerprint } from './perceptual.ts';

export * from './png.ts';
export * from './perceptual.ts';

/** Decode a PNG and return its perceptual fingerprint, ready for a passport. */
export function imageFingerprint(png: Buffer): Fingerprint {
  return dHash(decodePng(png));
}

/** Perceptual fingerprint from already-decoded pixels. */
export function imageFingerprintRaw(img: RawImage): Fingerprint {
  return dHash(img);
}
