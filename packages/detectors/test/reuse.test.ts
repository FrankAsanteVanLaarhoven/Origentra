import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReuseIndex } from '../src/index.ts';
import { createPassport, generateKeyPair } from '../../core/src/index.ts';
import { encodePng } from '../../media/src/index.ts';
import { makeImage, PATTERN_A, PATTERN_B, T0 } from './helpers.ts';

const TEXT = 'Alice\'s original protected article about Origentra provenance. '.repeat(12);

test('an exact copy published by a different account is a MATCH', () => {
  const idx = new ReuseIndex().addRaw('asset-1', 'alice', TEXT, 'text/plain');
  const d = idx.detect({ subjectId: 'post-9', publisherIdentityId: 'bob', bytes: TEXT, contentType: 'text/plain' });
  assert.equal(d.disposition, 'match');
  assert.equal(d.confidence, 1);
  assert.equal(d.matched, 'asset-1');
  assert.ok(d.evidence.some((e) => e.detail === 'owner:alice'));
  assert.ok(d.alternatives.length > 0, 'benign alternatives are always present');
});

test('a transformed copy is a NEAR_MATCH, not a certain match', () => {
  const idx = new ReuseIndex().addRaw('asset-1', 'alice', TEXT, 'text/plain');
  const transformed = TEXT.replace('original protected', 'ORIGINAL protected') + ' reposted';
  const d = idx.detect({ subjectId: 'post-9', publisherIdentityId: 'bob', bytes: transformed, contentType: 'text/plain' });
  assert.equal(d.disposition, 'near_match');
  assert.ok(d.confidence >= 0.6 && d.confidence < 1);
});

test('the owner re-publishing their own content is NOT flagged', () => {
  const idx = new ReuseIndex().addRaw('asset-1', 'alice', TEXT, 'text/plain');
  const d = idx.detect({ subjectId: 'post-1', publisherIdentityId: 'alice', bytes: TEXT, contentType: 'text/plain' });
  assert.equal(d.disposition, 'no_match');
});

test('unrelated content is NOT flagged (no false positive)', () => {
  const idx = new ReuseIndex().addRaw('asset-1', 'alice', TEXT, 'text/plain');
  const d = idx.detect({ subjectId: 'post-2', publisherIdentityId: 'bob', bytes: 'A totally unrelated essay about sailing boats. '.repeat(12), contentType: 'text/plain' });
  assert.equal(d.disposition, 'no_match');
});

test('reuse indexes a Content Passport and matches an exact re-post', () => {
  const passport = createPassport(TEXT, { assetId: 'asset-1', tenantId: 't', contentType: 'text/plain', createdAt: T0, creatorIdentityId: 'alice', aiInvolvement: 'none' }, generateKeyPair());
  const idx = new ReuseIndex().addPassport(passport);
  const d = idx.detect({ subjectId: 'post-9', publisherIdentityId: 'bob', bytes: TEXT });
  assert.equal(d.disposition, 'match');
});

test('a re-encoded/resized image copy is caught perceptually', () => {
  const original = encodePng(makeImage(64, 64, PATTERN_A));
  const idx = new ReuseIndex().addRaw('img-1', 'alice', original, 'image/png');
  const variant = encodePng(makeImage(48, 48, PATTERN_A)); // downscaled, different bytes
  const d = idx.detect({ subjectId: 'acct-x', publisherIdentityId: 'bob', bytes: variant, contentType: 'image/png' });
  assert.equal(d.disposition, 'near_match');
  assert.match(d.method, /perceptual/);

  // A visually different image is not flagged.
  const different = encodePng(makeImage(64, 64, PATTERN_B));
  const nd = idx.detect({ subjectId: 'acct-y', publisherIdentityId: 'bob', bytes: different, contentType: 'image/png' });
  assert.equal(nd.disposition, 'no_match');
});
