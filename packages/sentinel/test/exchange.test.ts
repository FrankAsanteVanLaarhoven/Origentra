import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AbuseSignalExchange,
  signReport,
  signAppeal,
  signAdjudication,
  type AbuseReport,
  type AbuseTarget,
} from '../src/index.ts';
import { generateKeyPair, TrustStore, type KeyPair } from '../../core/src/index.ts';

const T0 = '2026-07-19T00:00:00.000Z';
const TARGET: AbuseTarget = { type: 'account', id: 'acct-42' };

function reporter(trust: TrustStore): { key: KeyPair; id: string } {
  const key = generateKeyPair();
  trust.add(key.keyId, key.publicKeyPem);
  return { key, id: 'rep-' + key.keyId.slice(4, 10) };
}

function report(key: KeyPair, reporterId: string, reportId: string, confidence = 0.8): AbuseReport {
  return signReport(
    {
      reportId,
      target: TARGET,
      category: 'coordinated_harassment',
      evidence: [{ kind: 'incident', ref: 'sha256:' + reportId }],
      method: 'human_review',
      confidence,
      uncertainty: 'context-dependent; may be a heated but legitimate dispute',
      reporterIdentityId: reporterId,
      reportedAt: T0,
    },
    key,
  );
}

function setup(quorum = 2) {
  const reporterTrust = new TrustStore();
  const adjudicatorTrust = new TrustStore();
  const adjKey = generateKeyPair();
  adjudicatorTrust.add(adjKey.keyId, adjKey.publicKeyPem);
  const ex = new AbuseSignalExchange(reporterTrust, adjudicatorTrust, { quorum });
  return { ex, reporterTrust, adjKey };
}

function cat(ex: AbuseSignalExchange) {
  return ex.signals(TARGET).categories[0];
}

test('a single trusted report is single_source, not corroborated (below quorum)', () => {
  const { ex, reporterTrust } = setup(2);
  const r = reporter(reporterTrust);
  assert.equal(ex.submit(report(r.key, r.id, 'r1')).accepted, true);
  assert.equal(cat(ex)?.disposition, 'single_source');
  assert.equal(cat(ex)?.quorumMet, false);
  assert.equal(ex.log.size, 1, 'report is transparency-logged');
});

test('an untrusted reporter is rejected', () => {
  const { ex } = setup(2);
  const stranger = generateKeyPair();
  assert.equal(ex.submit(report(stranger, 'rogue', 'r1')).accepted, false);
  assert.equal(ex.signals(TARGET).categories.length, 0);
});

test('two DISTINCT trusted reporters reach a quorum; the same reporter twice does not', () => {
  const { ex, reporterTrust } = setup(2);
  const a = reporter(reporterTrust);
  ex.submit(report(a.key, a.id, 'r1'));
  ex.submit(report(a.key, a.id, 'r2')); // same reporter, second report
  assert.equal(cat(ex)?.distinctReporters, 1);
  assert.equal(cat(ex)?.disposition, 'single_source');

  const b = reporter(reporterTrust);
  ex.submit(report(b.key, b.id, 'r3'));
  assert.equal(cat(ex)?.distinctReporters, 2);
  assert.equal(cat(ex)?.disposition, 'corroborated');
});

test('a pending appeal marks the signal contested', () => {
  const { ex, reporterTrust } = setup(1);
  const a = reporter(reporterTrust);
  ex.submit(report(a.key, a.id, 'r1'));
  assert.equal(cat(ex)?.disposition, 'corroborated');

  const appellant = generateKeyPair();
  ex.appeal(signAppeal({ appealId: 'ap1', reportId: 'r1', appellantId: 'acct-42', statement: 'not me', appealedAt: T0 }, appellant));
  assert.equal(cat(ex)?.disposition, 'contested');
  assert.equal(cat(ex)?.appealStatus, 'pending');
});

test('an overturned report is removed from the active signal', () => {
  const { ex, reporterTrust, adjKey } = setup(1);
  const a = reporter(reporterTrust);
  ex.submit(report(a.key, a.id, 'r1'));
  ex.adjudicate(signAdjudication({ reportId: 'r1', decision: 'overturned', rationale: 'mistaken', adjudicatorId: 'adj', decidedAt: T0 }, adjKey));

  const c = cat(ex);
  assert.equal(c?.activeReports, 0);
  assert.equal(c?.disposition, 'overturned');
  assert.equal(c?.appealStatus, 'overturned');
});

test('an upheld adjudication resolves the appeal (no longer contested)', () => {
  const { ex, reporterTrust, adjKey } = setup(1);
  const a = reporter(reporterTrust);
  ex.submit(report(a.key, a.id, 'r1'));
  const appellant = generateKeyPair();
  ex.appeal(signAppeal({ appealId: 'ap1', reportId: 'r1', appellantId: 'acct-42', statement: 'not me', appealedAt: T0 }, appellant));
  ex.adjudicate(signAdjudication({ reportId: 'r1', appealId: 'ap1', decision: 'upheld', rationale: 'evidence stands', adjudicatorId: 'adj', decidedAt: T0 }, adjKey));

  const c = cat(ex);
  assert.equal(c?.disposition, 'corroborated');
  assert.equal(c?.appealStatus, 'upheld');
});

test('signals output is recommend-only: no verdict/enforcement field, always a disclaimer', () => {
  const { ex, reporterTrust } = setup(2);
  const a = reporter(reporterTrust);
  const b = reporter(reporterTrust);
  ex.submit(report(a.key, a.id, 'r1'));
  ex.submit(report(b.key, b.id, 'r2'));
  const summary = ex.signals(TARGET);

  const banned = ['verdict', 'ban', 'block', 'action', 'enforce', 'decision', 'sanction'];
  const keysTop = Object.keys(summary);
  const keysCat = summary.categories.flatMap((c) => Object.keys(c));
  for (const b0 of banned) {
    assert.ok(!keysTop.includes(b0), `top-level must not contain '${b0}'`);
    assert.ok(!keysCat.includes(b0), `category must not contain '${b0}'`);
  }
  assert.match(summary.disclaimer, /not an enforcement decision/);
});
