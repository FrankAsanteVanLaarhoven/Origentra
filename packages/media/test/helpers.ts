import type { RawImage } from '../src/index.ts';

/** Build an RGBA image from a brightness function f(x,y) -> number (clamped). */
export function makeImage(
  width: number,
  height: number,
  f: (x: number, y: number) => number,
): RawImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = Math.max(0, Math.min(255, Math.round(f(x / width, y / height))));
      const o = (y * width + x) * 4;
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { width, height, channels: 4, data };
}

// Smooth, low-frequency patterns survive downscaling (so dHash is scale-robust).
export const PATTERN_A = (x: number, y: number) =>
  128 + 100 * Math.sin(3 * Math.PI * x) * Math.sin(2 * Math.PI * y);

export const PATTERN_B = (x: number, y: number) =>
  128 + 100 * Math.sin(2 * Math.PI * x + 1) * Math.cos(4 * Math.PI * y);
