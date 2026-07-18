import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalize, canonicalBytes } from '../src/index.ts';

test('canonicalize sorts keys deterministically regardless of insertion order', () => {
  const a = canonicalize({ b: 1, a: 2, c: { z: 1, y: 2 } });
  const b = canonicalize({ c: { y: 2, z: 1 }, a: 2, b: 1 });
  assert.equal(a, b);
  assert.equal(a, '{"a":2,"b":1,"c":{"y":2,"z":1}}');
});

test('canonicalize omits undefined object properties', () => {
  assert.equal(canonicalize({ a: 1, b: undefined }), '{"a":1}');
});

test('canonicalize preserves array order', () => {
  assert.equal(canonicalize([3, 1, 2]), '[3,1,2]');
});

test('canonicalize rejects non-finite numbers', () => {
  assert.throws(() => canonicalize({ x: Number.NaN }), /non-finite/);
  assert.throws(() => canonicalize({ x: Infinity }), /non-finite/);
});

test('canonicalBytes is utf8', () => {
  assert.ok(Buffer.isBuffer(canonicalBytes({ a: 'é' })));
});
