import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TransparencyLog,
  Witness,
  cosignCheckpoint,
  verifyCosignature,
  verifyWitnessed,
  detectSplitView,
  type WitnessedCheckpoint,
} from '../src/index.ts';
import { generateKeyPair, TrustStore } from '../../core/src/index.ts';

function fill(log: TransparencyLog, n: number, from = 0) {
  for (let i = from; i < from + n; i++) log.append(`e-${i}`);
}

function setup() {
  const logKey = generateKeyPair();
  const logTrust = new TrustStore().add(logKey.keyId, logKey.publicKeyPem);
  const w1 = generateKeyPair();
  const w2 = generateKeyPair();
  const witnessTrust = new TrustStore().add(w1.keyId, w1.publicKeyPem).add(w2.keyId, w2.publicKeyPem);
  return { logKey, logTrust, w1, w2, witnessTrust };
}

test('a witness cosigns honest append-only growth and the cosignature verifies', () => {
  const { logKey, logTrust, w1 } = setup();
  const witness = new Witness(w1, logTrust);
  const log = new TransparencyLog();

  fill(log, 5);
  const r1 = witness.cosign(log.checkpoint(logKey));
  assert.equal(r1.accepted, true);

  fill(log, 4, 5); // grow to 9
  const cp9 = log.checkpoint(logKey);
  const r2 = witness.cosign(cp9, log.consistencyProof(5));
  assert.equal(r2.accepted, true);
  assert.equal(verifyCosignature(cp9, r2.cosignature!), true);
});

test('a witness refuses a rollback to a smaller size', () => {
  const { logKey, logTrust, w1 } = setup();
  const witness = new Witness(w1, logTrust);
  const log = new TransparencyLog();
  fill(log, 9);
  witness.cosign(log.checkpoint(logKey)); // sees size 9

  const smaller = new TransparencyLog();
  fill(smaller, 5);
  const res = witness.cosign(smaller.checkpoint(logKey));
  assert.equal(res.accepted, false);
  assert.equal(res.reason, 'rollback');
});

test('a witness refuses a same-size fork (different root)', () => {
  const { logKey, logTrust, w1 } = setup();
  const witness = new Witness(w1, logTrust);
  const honest = new TransparencyLog();
  fill(honest, 6);
  witness.cosign(honest.checkpoint(logKey)); // sees honest size-6 head

  const forked = new TransparencyLog();
  for (let i = 0; i < 6; i++) forked.append(`FORK-${i}`); // same size, different entries
  const res = witness.cosign(forked.checkpoint(logKey));
  assert.equal(res.accepted, false);
  assert.equal(res.reason, 'fork_same_size');
});

test('a witness refuses a larger fork that rewrote history', () => {
  const { logKey, logTrust, w1 } = setup();
  const witness = new Witness(w1, logTrust);
  const honest = new TransparencyLog();
  fill(honest, 5);
  witness.cosign(honest.checkpoint(logKey)); // sees honest size-5 head

  // A different log (rewrote entry 0) grown to 8; its consistency proof from 5
  // has an old root that does not match what the witness saw.
  const forked = new TransparencyLog();
  forked.append('REWRITTEN');
  for (let i = 1; i < 8; i++) forked.append(`e-${i}`);
  const res = witness.cosign(forked.checkpoint(logKey), forked.consistencyProof(5));
  assert.equal(res.accepted, false);
  assert.equal(res.reason, 'consistency_proof_mismatch');
});

test('verifyWitnessed requires a quorum of trusted witness cosignatures', () => {
  const { logKey, logTrust, w1, w2, witnessTrust } = setup();
  const log = new TransparencyLog();
  fill(log, 7);
  const cp = log.checkpoint(logKey);
  const c1 = new Witness(w1, logTrust).cosign(cp).cosignature!;
  const c2 = new Witness(w2, logTrust).cosign(cp).cosignature!;

  const wcp: WitnessedCheckpoint = { checkpoint: cp, cosignatures: [c1, c2] };
  assert.equal(verifyWitnessed(wcp, logTrust, witnessTrust, 2), true);

  // An untrusted witness cosignature does not count toward the quorum.
  const rogue = generateKeyPair();
  const cr = cosignCheckpoint(cp, rogue);
  const wcp2: WitnessedCheckpoint = { checkpoint: cp, cosignatures: [c1, cr] };
  assert.equal(verifyWitnessed(wcp2, logTrust, witnessTrust, 2), false);
  assert.equal(verifyWitnessed(wcp2, logTrust, witnessTrust, 1), true);
});

test('a split view (same size, different root) is directly detectable', () => {
  const { logKey } = setup();
  const a = new TransparencyLog();
  fill(a, 6);
  const b = new TransparencyLog();
  for (let i = 0; i < 6; i++) b.append(`FORK-${i}`);
  assert.equal(detectSplitView(a.checkpoint(logKey), b.checkpoint(logKey)), true);
  assert.equal(detectSplitView(a.checkpoint(logKey), a.checkpoint(logKey)), false);
});
