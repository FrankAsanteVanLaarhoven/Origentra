import type { RawImage } from '../../media/src/index.ts';

export const T0 = '2026-07-19T00:00:00.000Z';

export function makeImage(w: number, h: number, f: (x: number, y: number) => number): RawImage {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.max(0, Math.min(255, Math.round(f(x / w, y / h))));
      const o = (y * w + x) * 4;
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { width: w, height: h, channels: 4, data };
}

export const PATTERN_A = (x: number, y: number) => 128 + 100 * Math.sin(3 * Math.PI * x) * Math.sin(2 * Math.PI * y);
export const PATTERN_B = (x: number, y: number) => 128 + 100 * Math.sin(2 * Math.PI * x + 1) * Math.cos(4 * Math.PI * y);
