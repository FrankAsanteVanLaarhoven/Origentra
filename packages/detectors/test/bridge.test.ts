import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReuseIndex, detectionToReport, detectionToLinkage } from '../src/index.ts';
import { AbuseSignalExchange, LinkageGraph, type AbuseTarget } from '../../sentinel/src/index.ts';
import { generateKeyPair, TrustStore } from '../../core/src/index.ts';
import { T0 } from './helpers.ts';

const TEXT = 'Alice\'s protected work republished without permission. '.repeat(12);
const TARGET: AbuseTarget = { type: 'account', id: 'bob' };

function detectReuse() {
  const idx = new ReuseIndex().addRaw('asset-1', 'alice', TEXT, 'text/plain');
  return idx.detect({ subjectId: 'bob', publisherIdentityId: 'bob', bytes: TEXT, contentType: 'text/plain' });
}

test('a detection becomes a signed report that enters the exchange as a single_source signal', () => {
  const d = detectReuse();
  assert.equal(d.disposition, 'match');

  const reporterTrust = new TrustStore();
  const detectorKey = generateKeyPair();
  reporterTrust.add(detectorKey.keyId, detectorKey.publicKeyPem);
  const ex = new AbuseSignalExchange(reporterTrust, new TrustStore(), { quorum: 2 });

  const report = detectionToReport(d, { reportId: 'r1', reporterIdentityId: 'detector-reuse', target: TARGET, reportedAt: T0 }, detectorKey);
  assert.ok(report.uncertainty.length > 0, 'detection caveats carried into the report');
  assert.equal(ex.submit(report).accepted, true);
  assert.equal(ex.signals(TARGET).categories[0]?.disposition, 'single_source');
});

test('two independent detector-reporters corroborate a signal', () => {
  const d = detectReuse();
  const reporterTrust = new TrustStore();
  const k1 = generateKeyPair();
  const k2 = generateKeyPair();
  reporterTrust.add(k1.keyId, k1.publicKeyPem).add(k2.keyId, k2.publicKeyPem);
  const ex = new AbuseSignalExchange(reporterTrust, new TrustStore(), { quorum: 2 });

  ex.submit(detectionToReport(d, { reportId: 'r1', reporterIdentityId: 'det-1', target: TARGET, reportedAt: T0 }, k1));
  ex.submit(detectionToReport(d, { reportId: 'r2', reporterIdentityId: 'det-2', target: TARGET, reportedAt: T0 }, k2));
  assert.equal(ex.signals(TARGET).categories[0]?.disposition, 'corroborated');
});

test('a non-positive detection cannot be reported', () => {
  const idx = new ReuseIndex().addRaw('asset-1', 'alice', TEXT, 'text/plain');
  const noMatch = idx.detect({ subjectId: 'carol', publisherIdentityId: 'carol', bytes: 'unrelated text', contentType: 'text/plain' });
  assert.throws(() => detectionToReport(noMatch, { reportId: 'r1', reporterIdentityId: 'd', target: TARGET, reportedAt: T0 }, generateKeyPair()), /no_match/);
});

test('shared content becomes a signed linkage edge (sock-puppet evidence)', () => {
  const d = detectReuse();
  const linkerKey = generateKeyPair();
  const trust = new TrustStore().add(linkerKey.keyId, linkerKey.publicKeyPem);
  const edge = detectionToLinkage(d, 'bob', 'alice', T0, linkerKey);

  const graph = new LinkageGraph(trust);
  assert.equal(graph.add(edge), true);
  assert.deepEqual(graph.cluster('bob', 0.5), ['alice', 'bob']);
});
