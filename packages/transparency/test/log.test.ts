import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TransparencyLog,
  verifyCheckpoint,
  verifyInclusionResult,
  verifyConsistencyResult,
} from '../src/index.ts';
import { generateKeyPair, TrustStore } from '../../core/src/index.ts';

function fill(log: TransparencyLog, n: number, from = 0) {
  for (let i = from; i < from + n; i++) log.append(`entry-${i}`);
}

test('a signed checkpoint verifies only under the trusted key', () => {
  const key = generateKeyPair();
  const trust = new TrustStore().add(key.keyId, key.publicKeyPem);
  const log = new TransparencyLog();
  fill(log, 10);
  const cp = log.checkpoint(key);
  assert.equal(verifyCheckpoint(cp, trust), true);
  assert.equal(verifyCheckpoint(cp, new TrustStore()), false, 'untrusted signer');
  assert.equal(verifyCheckpoint({ ...cp, size: cp.size + 1 }, trust), false, 'tampered size');
  assert.equal(verifyCheckpoint({ ...cp, rootHash: 'ff'.repeat(32) }, trust), false, 'tampered root');
});

test('inclusion proofs verify and reject tampering', () => {
  const log = new TransparencyLog();
  fill(log, 13);
  const r = log.inclusionProof(6);
  assert.equal(verifyInclusionResult(r), true);
  assert.equal(verifyInclusionResult({ ...r, leafHash: 'aa'.repeat(32) }), false);
});

test('consistency proof matches an earlier checkpoint and proves append-only growth', () => {
  const key = generateKeyPair();
  const log = new TransparencyLog();
  fill(log, 5);
  const cp5 = log.checkpoint(key);
  fill(log, 4, 5); // grow to 9
  const proof = log.consistencyProof(5);
  assert.equal(proof.oldRoot, cp5.rootHash, 'old root equals the size-5 checkpoint');
  assert.equal(verifyConsistencyResult(proof), true);
  assert.equal(verifyConsistencyResult({ ...proof, newRoot: 'ff'.repeat(32) }), false);
});
