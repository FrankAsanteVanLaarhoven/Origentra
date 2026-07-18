import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRights } from '../src/index.ts';
import { T0 } from './helpers.ts';

const NOW = T0;

test('required right present and valid -> satisfied', () => {
  const r = evaluateRights(
    [{ kind: 'ownership', holder: 'x' }],
    { required: ['ownership'] },
    NOW,
  );
  assert.equal(r.satisfied, true);
  assert.equal(r.blocking.length, 0);
});

test('missing required right blocks', () => {
  const r = evaluateRights([], { required: ['music_licence'] }, NOW);
  assert.equal(r.satisfied, false);
  assert.deepEqual(r.blocking, [{ kind: 'music_licence', reason: 'missing' }]);
});

test('expired right blocks', () => {
  const r = evaluateRights(
    [{ kind: 'music_licence', holder: 'label', expiresAt: '2020-01-01T00:00:00.000Z' }],
    { required: ['music_licence'] },
    NOW,
  );
  assert.equal(r.satisfied, false);
  assert.equal(r.blocking[0]?.reason, 'expired');
});

test('revoked consent blocks', () => {
  const r = evaluateRights(
    [{ kind: 'likeness_consent', holder: 'model', revokedAt: '2026-01-01T00:00:00.000Z' }],
    { required: ['likeness_consent'] },
    NOW,
  );
  assert.equal(r.blocking[0]?.reason, 'revoked');
});

test('disputed right blocks', () => {
  const r = evaluateRights(
    [{ kind: 'ownership', holder: 'x', disputed: true }],
    { required: ['ownership'] },
    NOW,
  );
  assert.equal(r.blocking[0]?.reason, 'disputed');
});

test('platform restriction excludes non-listed platform', () => {
  const r = evaluateRights(
    [{ kind: 'ownership', holder: 'x', platforms: ['youtube'] }],
    { required: ['ownership'], platform: 'tiktok' },
    NOW,
  );
  assert.equal(r.blocking[0]?.reason, 'platform_excluded');
});

test('advertising use blocked when not permitted', () => {
  const r = evaluateRights(
    [{ kind: 'ownership', holder: 'x', advertisingPermitted: false }],
    { required: ['ownership'], advertising: true },
    NOW,
  );
  assert.equal(r.blocking[0]?.reason, 'advertising_not_permitted');
});

test('one valid record among several satisfies the requirement', () => {
  const r = evaluateRights(
    [
      { kind: 'ownership', holder: 'expired', expiresAt: '2020-01-01T00:00:00.000Z' },
      { kind: 'ownership', holder: 'valid' },
    ],
    { required: ['ownership'] },
    NOW,
  );
  assert.equal(r.satisfied, true);
});
