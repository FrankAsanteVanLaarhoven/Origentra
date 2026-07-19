import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalKeyProvider, encrypt, decrypt, rewrap } from '../src/index.ts';

test('envelope encrypt/decrypt round-trips under the customer key', () => {
  const kms = LocalKeyProvider.generate();
  const env = encrypt('sensitive licence document', kms);
  assert.equal(decrypt(env, kms).toString('utf8'), 'sensitive licence document');
  assert.equal(env.keyId, kms.keyId);
});

test('a wrong customer key cannot decrypt (GCM auth on the wrapped DEK)', () => {
  const env = encrypt('secret', LocalKeyProvider.generate());
  assert.throws(() => decrypt(env, LocalKeyProvider.generate()));
});

test('tampering with the ciphertext fails closed', () => {
  const kms = LocalKeyProvider.generate();
  const env = encrypt('secret payload', kms);
  const flipped = Buffer.from(env.ciphertext, 'base64');
  flipped[0] = flipped[0]! ^ 0xff;
  assert.throws(() => decrypt({ ...env, ciphertext: flipped.toString('base64') }, kms));
});

test('root-key rotation re-wraps the DEK without touching ciphertext', () => {
  const oldKms = LocalKeyProvider.generate('cmk/2024');
  const newKms = LocalKeyProvider.generate('cmk/2025');
  const env = encrypt('rotate me', oldKms);

  const rotated = rewrap(env, oldKms, newKms);
  assert.equal(rotated.ciphertext, env.ciphertext, 'data ciphertext unchanged');
  assert.equal(rotated.keyId, 'cmk/2025');
  assert.equal(decrypt(rotated, newKms).toString('utf8'), 'rotate me');
  assert.throws(() => decrypt(rotated, oldKms), 'old key no longer unwraps');
});
