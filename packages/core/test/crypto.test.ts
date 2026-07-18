import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sha256,
  digestObject,
  generateKeyPair,
  keyIdFromPublicKey,
  sign,
  verify,
  fingerprint,
  similarity,
} from '../src/index.ts';

test('sha256 is stable and self-describing', () => {
  assert.equal(sha256('origentra'), sha256(Buffer.from('origentra')));
  assert.match(sha256('x'), /^sha256:[0-9a-f]{64}$/);
});

test('digestObject is canonical (key order independent)', () => {
  assert.equal(digestObject({ a: 1, b: 2 }), digestObject({ b: 2, a: 1 }));
});

test('ed25519 sign/verify round trip', () => {
  const k = generateKeyPair();
  const msg = Buffer.from('hello');
  const sig = sign(k.privateKeyPem, msg);
  assert.equal(verify(k.publicKeyPem, msg, sig), true);
});

test('ed25519 verify fails on tampered message and never throws on garbage', () => {
  const k = generateKeyPair();
  const sig = sign(k.privateKeyPem, Buffer.from('hello'));
  assert.equal(verify(k.publicKeyPem, Buffer.from('hell0'), sig), false);
  assert.equal(verify(k.publicKeyPem, Buffer.from('hello'), 'not-base64!!'), false);
});

test('keyId is stable for a given public key', () => {
  const k = generateKeyPair();
  assert.equal(keyIdFromPublicKey(k.publicKeyPem), k.keyId);
  assert.match(k.keyId, /^key:[0-9a-f]{20}$/);
});

test('fingerprint of identical content is identical; similarity 1', () => {
  const a = fingerprint('the quick brown fox jumps over the lazy dog'.repeat(4));
  const b = fingerprint('the quick brown fox jumps over the lazy dog'.repeat(4));
  assert.deepEqual(a, b);
  assert.equal(similarity(a, b), 1);
});

test('fingerprint degrades gracefully under a small edit (survivability)', () => {
  const base = 'the quick brown fox jumps over the lazy dog. '.repeat(20);
  const edited = base.replace('lazy dog. the quick', 'lazy DOG. the quick'); // localized edit
  const s = similarity(fingerprint(base), fingerprint(edited));
  assert.ok(s > 0.6, `expected localized edit to remain similar, got ${s}`);
  assert.ok(s < 1, `expected some change, got ${s}`);
});

test('fingerprint of unrelated content has low similarity', () => {
  const s = similarity(
    fingerprint('completely different content about oranges and boats'.repeat(5)),
    fingerprint('the quick brown fox jumps over the lazy dog'.repeat(5)),
  );
  assert.ok(s < 0.3, `expected low similarity, got ${s}`);
});
