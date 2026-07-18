import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TransparencyLog,
  Witness,
  LocalWitnessTransport,
  distributeCheckpoint,
  auditSplitView,
  verifyWitnessed,
} from '../src/index.ts';
import { generateKeyPair, TrustStore, type KeyPair } from '../../core/src/index.ts';

function fill(log: TransparencyLog, n: number, from = 0) {
  for (let i = from; i < from + n; i++) log.append(`e-${i}`);
}

function witnesses(logTrust: TrustStore, n: number) {
  const witnessTrust = new TrustStore();
  const transports = [];
  for (let i = 0; i < n; i++) {
    const k: KeyPair = generateKeyPair();
    witnessTrust.add(k.keyId, k.publicKeyPem);
    transports.push(new LocalWitnessTransport(new Witness(k, logTrust)));
  }
  return { witnessTrust, transports };
}

function setup() {
  const logKey = generateKeyPair();
  const logTrust = new TrustStore().add(logKey.keyId, logKey.publicKeyPem);
  return { logKey, logTrust };
}

test('an honest checkpoint is distributed to a quorum of witnesses', async () => {
  const { logKey, logTrust } = setup();
  const { witnessTrust, transports } = witnesses(logTrust, 3);
  const log = new TransparencyLog();

  fill(log, 5);
  const r1 = await distributeCheckpoint(log.checkpoint(logKey), (m) => log.consistencyProof(m), transports);
  assert.equal(r1.accepted, 3);
  assert.equal(verifyWitnessed(r1.witnessed, logTrust, witnessTrust, 2), true);

  fill(log, 4, 5); // grow to 9; witnesses last-saw 5, get a consistency proof
  const r2 = await distributeCheckpoint(log.checkpoint(logKey), (m) => log.consistencyProof(m), transports);
  assert.equal(r2.accepted, 3);
  assert.equal(verifyWitnessed(r2.witnessed, logTrust, witnessTrust, 2), true);
});

test('a forked checkpoint cannot reach a quorum (witnesses refuse)', async () => {
  const { logKey, logTrust } = setup();
  const { witnessTrust, transports } = witnesses(logTrust, 3);

  const honest = new TransparencyLog();
  fill(honest, 9);
  await distributeCheckpoint(honest.checkpoint(logKey), (m) => honest.consistencyProof(m), transports);

  const fork = new TransparencyLog();
  for (let i = 0; i < 9; i++) fork.append(`X-${i}`); // same size, different root
  const rf = await distributeCheckpoint(fork.checkpoint(logKey), (m) => fork.consistencyProof(m), transports);
  assert.equal(rf.accepted, 0);
  assert.ok(rf.refusals.every((r) => r.reason === 'fork_same_size'));
  assert.equal(verifyWitnessed(rf.witnessed, logTrust, witnessTrust, 1), false);
});

test('auditSplitView detects a log that showed two witnesses different heads', async () => {
  const { logKey, logTrust } = setup();
  const wA = new Witness(generateKeyPair(), logTrust);
  const wB = new Witness(generateKeyPair(), logTrust);
  const tA = new LocalWitnessTransport(wA);
  const tB = new LocalWitnessTransport(wB);

  const honest = new TransparencyLog();
  fill(honest, 6);
  wA.cosign(honest.checkpoint(logKey)); // witness A sees the honest head

  const fork = new TransparencyLog();
  for (let i = 0; i < 6; i++) fork.append(`F-${i}`);
  wB.cosign(fork.checkpoint(logKey)); // witness B was shown a fork of the same size

  const audit = await auditSplitView('origentra-log/1', [tA, tB]);
  assert.equal(audit.forked, true);
  assert.ok(audit.evidence);
});

test('with no fork, the auditor reports agreement', async () => {
  const { logKey, logTrust } = setup();
  const { transports } = witnesses(logTrust, 3);
  const log = new TransparencyLog();
  fill(log, 7);
  await distributeCheckpoint(log.checkpoint(logKey), (m) => log.consistencyProof(m), transports);
  const audit = await auditSplitView('origentra-log/1', transports);
  assert.equal(audit.forked, false);
});
