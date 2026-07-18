import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodePng, decodePng, type RawImage } from '../src/index.ts';
import { makeImage, PATTERN_A } from './helpers.ts';

test('RGBA PNG round-trips exactly', () => {
  const img = makeImage(24, 16, PATTERN_A);
  const decoded = decodePng(encodePng(img));
  assert.equal(decoded.width, 24);
  assert.equal(decoded.height, 16);
  assert.equal(decoded.channels, 4);
  assert.deepEqual(decoded.data, img.data);
});

test('grayscale (1-channel) PNG round-trips exactly', () => {
  const w = 10;
  const h = 8;
  const data = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i++) data[i] = (i * 7) % 256;
  const img: RawImage = { width: w, height: h, channels: 1, data };
  const decoded = decodePng(encodePng(img));
  assert.equal(decoded.channels, 1);
  assert.deepEqual(decoded.data, data);
});

test('a corrupt signature is rejected', () => {
  assert.throws(() => decodePng(Buffer.from('not a png at all')), /signature/);
});
