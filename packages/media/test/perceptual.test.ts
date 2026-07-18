import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodePng,
  dHash,
  imageFingerprint,
  imageFingerprintRaw,
  hammingDistance,
  perceptualSimilarity,
} from '../src/index.ts';
import { createPassport, generateKeyPair } from '../../core/src/index.ts';
import { makeImage, PATTERN_A, PATTERN_B } from './helpers.ts';

test('identical images hash identically (distance 0)', () => {
  const a = dHash(makeImage(64, 64, PATTERN_A));
  const b = dHash(makeImage(64, 64, PATTERN_A));
  assert.equal(hammingDistance(a, b), 0);
  assert.equal(perceptualSimilarity(a, b), 1);
});

test('perceptual hash survives downscale 64->32 (scale robustness)', () => {
  const big = dHash(makeImage(64, 64, PATTERN_A));
  const small = dHash(makeImage(32, 32, PATTERN_A));
  const d = hammingDistance(big, small);
  assert.ok(d <= 6, `expected scale-robust hash, hamming=${d}`);
});

test('perceptual hash survives a global brightness shift', () => {
  const base = dHash(makeImage(64, 64, PATTERN_A));
  const brighter = dHash(makeImage(64, 64, (x, y) => PATTERN_A(x, y) + 35));
  const d = hammingDistance(base, brighter);
  assert.ok(d <= 4, `expected brightness-robust hash, hamming=${d}`);
});

test('perceptual hash survives PNG re-encode (format survivability)', () => {
  const img = makeImage(48, 48, PATTERN_A);
  const direct = imageFingerprintRaw(img);
  const viaPng = imageFingerprint(encodePng(img));
  assert.equal(hammingDistance(direct, viaPng), 0);
});

test('unrelated images are far apart', () => {
  const a = dHash(makeImage(64, 64, PATTERN_A));
  const b = dHash(makeImage(64, 64, PATTERN_B));
  const d = hammingDistance(a, b);
  assert.ok(d >= 16, `expected distinct images to differ, hamming=${d}`);
  assert.ok(perceptualSimilarity(a, b) < 0.8);
});

test('a Content Passport can carry a perceptual fingerprint', () => {
  const img = makeImage(64, 64, PATTERN_A);
  const fp = imageFingerprintRaw(img);
  const passport = createPassport(
    encodePng(img),
    {
      assetId: 'img-1',
      tenantId: 't',
      contentType: 'image/png',
      createdAt: '2026-07-18T10:00:00.000Z',
      creatorIdentityId: 'c',
      aiInvolvement: 'none',
      extraFingerprints: [fp],
    },
    generateKeyPair(),
  );
  const algos = passport.manifest.fingerprints.map((f) => f.algo);
  assert.ok(algos.includes('cdc-gear-v1'), 'CDC fingerprint always present');
  assert.ok(algos.includes('dhash-8x8-v1'), 'perceptual fingerprint attached');
});
