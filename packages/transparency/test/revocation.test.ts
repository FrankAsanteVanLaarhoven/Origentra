import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RevocationRegistry, verifyInclusionResult } from '../src/index.ts';
import { generateKeyPair, TrustStore } from '../../core/src/index.ts';

const T0 = '2026-07-19T00:00:00.000Z';

test('a trusted revocation is accepted, indexed and logged', () => {
  const authority = generateKeyPair();
  const trust = new TrustStore().add(authority.keyId, authority.publicKeyPem);
  const reg = new RevocationRegistry(trust);

  const res = reg.revoke({ type: 'passport', id: 'sha256:abc' }, 'compromise', T0, authority);
  assert.equal(res.accepted, true);
  assert.equal(reg.isRevoked('passport', 'sha256:abc'), true);
  assert.equal(reg.isRevoked('passport', 'sha256:other'), false);
  assert.equal(reg.log.size, 1);

  // The revocation is provably in the transparency log.
  assert.equal(verifyInclusionResult(reg.log.inclusionProof(0)), true);
});

test('an untrusted revocation is rejected and does not revoke anything', () => {
  const authority = generateKeyPair();
  const trust = new TrustStore().add(authority.keyId, authority.publicKeyPem);
  const reg = new RevocationRegistry(trust);

  const stranger = generateKeyPair();
  const res = reg.revoke({ type: 'identity', id: 'id-x' }, 'malicious', T0, stranger);
  assert.equal(res.accepted, false);
  assert.equal(reg.isRevoked('identity', 'id-x'), false);
  assert.equal(reg.log.size, 0);
});

test('fromEntries admits only the trusted subset', () => {
  const authority = generateKeyPair();
  const stranger = generateKeyPair();
  const trust = new TrustStore().add(authority.keyId, authority.publicKeyPem);

  const good = new RevocationRegistry(trust).revoke({ type: 'passport', id: 'a' }, 'r', T0, authority).entry;
  const bad = new RevocationRegistry(trust).revoke({ type: 'passport', id: 'b' }, 'r', T0, stranger).entry;

  const reg = RevocationRegistry.fromEntries([good, bad], trust);
  assert.equal(reg.isRevoked('passport', 'a'), true);
  assert.equal(reg.isRevoked('passport', 'b'), false, 'untrusted entry ignored');
  assert.equal(reg.size, 1);
});
