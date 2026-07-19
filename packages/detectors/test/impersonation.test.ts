import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ImpersonationIndex } from '../src/index.ts';
import { imageFingerprintRaw } from '../../media/src/index.ts';
import { makeImage, PATTERN_A, PATTERN_B } from './helpers.ts';

function brandIndex() {
  return new ImpersonationIndex().add({ id: 'brand-paypal', names: ['PayPal'], domains: ['paypal.com'] });
}

test('a digit-substitution look-alike handle is a MATCH (homoglyph skeleton)', () => {
  const d = brandIndex().detectHandle({ subjectId: 'acct-x', name: 'PayPa1' }); // 1 -> l
  assert.equal(d.disposition, 'match');
  assert.equal(d.matched, 'brand-paypal');
  assert.ok(d.confidence >= 0.85);
});

test('a Cyrillic look-alike domain is a MATCH', () => {
  const d = brandIndex().detectHandle({ subjectId: 'acct-y', domain: 'pаypal.com' }); // Cyrillic 'а'
  assert.equal(d.disposition, 'match');
});

test('a typosquat within a small edit distance is a NEAR_MATCH', () => {
  const d = brandIndex().detectHandle({ subjectId: 'acct-z', domain: 'paypall.com' });
  assert.equal(d.disposition, 'near_match');
});

test('an identical name is NOT impersonation on its own', () => {
  const d = brandIndex().detectHandle({ subjectId: 'acct-w', name: 'PayPal' });
  assert.equal(d.disposition, 'no_match');
});

test('an unrelated name is NOT flagged', () => {
  const d = brandIndex().detectHandle({ subjectId: 'acct-u', name: 'Acme Widgets Ltd' });
  assert.equal(d.disposition, 'no_match');
});

test('a perceptually similar profile image on another account is a likeness NEAR_MATCH', () => {
  const ref = imageFingerprintRaw(makeImage(64, 64, PATTERN_A));
  const idx = new ImpersonationIndex().add({ id: 'person-1', names: ['Alice'], imageFingerprint: ref });

  const impostorImg = imageFingerprintRaw(makeImage(48, 48, PATTERN_A)); // same face, resized
  const d = idx.detectLikeness({ subjectId: 'acct-9', imageFingerprint: impostorImg });
  assert.equal(d.disposition, 'near_match');
  assert.equal(d.matched, 'person-1');

  // The identity's own account is not flagged.
  const own = idx.detectLikeness({ subjectId: 'person-1', imageFingerprint: impostorImg });
  assert.equal(own.disposition, 'no_match');

  // A different face is not flagged.
  const other = idx.detectLikeness({ subjectId: 'acct-8', imageFingerprint: imageFingerprintRaw(makeImage(64, 64, PATTERN_B)) });
  assert.equal(other.disposition, 'no_match');
});
