import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  signReport,
  verifyReport,
  signAppeal,
  verifyAppeal,
  signAdjudication,
  verifyAdjudication,
  signLinkage,
  verifyLinkage,
  type AbuseReport,
} from '../src/index.ts';
import { generateKeyPair, TrustStore } from '../../core/src/index.ts';

const T0 = '2026-07-19T00:00:00.000Z';

function reportFields(): Omit<AbuseReport, 'signer' | 'signature'> {
  return {
    reportId: 'r1',
    target: { type: 'account', id: 'acct-42' },
    category: 'scam_fraud',
    evidence: [{ kind: 'scam_url', ref: 'sha256:aaa' }],
    method: 'human_review',
    confidence: 0.8,
    uncertainty: 'single observation; could be a compromised legitimate account',
    reporterIdentityId: 'rep-1',
    reportedAt: T0,
  };
}

test('a report from a trusted reporter verifies; tampering and untrusted fail', () => {
  const key = generateKeyPair();
  const trust = new TrustStore().add(key.keyId, key.publicKeyPem);
  const report = signReport(reportFields(), key);
  assert.equal(verifyReport(report, trust), true);
  assert.equal(verifyReport(report, new TrustStore()), false);
  assert.equal(verifyReport({ ...report, confidence: 0.1 }, trust), false, 'tampered confidence');
});

test('confidence must be in [0,1] and an uncertainty statement is required', () => {
  const key = generateKeyPair();
  assert.throws(() => signReport({ ...reportFields(), confidence: 1.5 }, key), /confidence/);
  assert.throws(() => signReport({ ...reportFields(), uncertainty: '' }, key), /uncertainty/);
});

test('appeals are open (any valid signature), adjudications are trust-gated', () => {
  const appellant = generateKeyPair();
  const appeal = signAppeal(
    { appealId: 'ap1', reportId: 'r1', appellantId: 'acct-42', statement: 'this is not me', appealedAt: T0 },
    appellant,
  );
  assert.equal(verifyAppeal(appeal), true); // no trust store needed — due process

  const adjKey = generateKeyPair();
  const adjTrust = new TrustStore().add(adjKey.keyId, adjKey.publicKeyPem);
  const adj = signAdjudication(
    { reportId: 'r1', decision: 'overturned', rationale: 'mistaken identity', adjudicatorId: 'adj-1', decidedAt: T0 },
    adjKey,
  );
  assert.equal(verifyAdjudication(adj, adjTrust), true);
  assert.equal(verifyAdjudication(adj, new TrustStore()), false, 'untrusted adjudicator');
});

test('linkage edges are signed and trust-gated', () => {
  const key = generateKeyPair();
  const trust = new TrustStore().add(key.keyId, key.publicKeyPem);
  const edge = signLinkage(
    { a: 'acct-1', b: 'acct-2', basis: 'reused_passport', evidenceRef: 'sha256:bbb', confidence: 0.9, assertedAt: T0 },
    key,
  );
  assert.equal(verifyLinkage(edge, trust), true);
  assert.equal(verifyLinkage(edge, new TrustStore()), false);
});
