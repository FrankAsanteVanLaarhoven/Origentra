import { test } from 'node:test';
import assert from 'node:assert/strict';
import { videoFingerprint, videoContainment, videoSimilarity, type RawImage } from '../src/index.ts';

function makeImage(w: number, h: number, f: (x: number, y: number) => number): RawImage {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.max(0, Math.min(255, Math.round(f(x / w, y / h))));
      const o = (y * w + x) * 4;
      data[o] = v; data[o + 1] = v; data[o + 2] = v; data[o + 3] = 255;
    }
  }
  return { width: w, height: h, channels: 4, data };
}

const moving = (phase: number) => (x: number, y: number) => 128 + 100 * Math.sin(3 * Math.PI * x + phase) * Math.sin(2 * Math.PI * y);
const other = (phase: number) => (x: number, y: number) => 128 + 100 * Math.cos(4 * Math.PI * y + phase) * Math.sin(2 * Math.PI * x + 1);

function clip(n: number, size: number, gen: (phase: number) => (x: number, y: number) => number): RawImage[] {
  return Array.from({ length: n }, (_, i) => makeImage(size, size, gen(i * 0.6)));
}

test('identical video clips match perfectly', () => {
  const fp = videoFingerprint(clip(12, 64, moving));
  assert.equal(videoSimilarity(fp, fp), 1);
});

test('a re-encoded/resized clip is still contained in the original', () => {
  const orig = videoFingerprint(clip(12, 64, moving));
  const resized = videoFingerprint(clip(12, 40, moving));
  assert.ok(videoContainment(resized, orig) >= 0.8, `containment ${videoContainment(resized, orig)}`);
});

test('a sub-clip is contained in the full video', () => {
  const full = videoFingerprint(clip(12, 64, moving));
  const half = videoFingerprint(clip(6, 64, moving));
  assert.ok(videoContainment(half, full) >= 0.9);
});

test('an unrelated clip is not contained', () => {
  const a = videoFingerprint(clip(12, 64, moving));
  const b = videoFingerprint(clip(12, 64, other));
  assert.ok(videoContainment(b, a) < 0.3, `containment ${videoContainment(b, a)}`);
});
