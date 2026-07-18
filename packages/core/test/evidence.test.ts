import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evidenceCompleteness, type EvidencePack } from '../src/index.ts';

function fullPack(): EvidencePack {
  return {
    incidentId: 'inc-1',
    tenantId: 'tenant-1',
    affectedIdentityId: 'id-1',
    affectedAssetIds: ['asset-1'],
    detectionSource: 'sentinel',
    timeline: [{ at: '2026-07-18T10:00:00.000Z', event: 'detected' }],
    assetDigests: ['sha256:aaa'],
    similarityScores: [0.9],
    provenanceStates: ['PROVENANCE_RECOVERED'],
    rightsRecords: [{ kind: 'ownership', holder: 'id-1' }],
    humanDecision: 'confirmed_infringement',
    containmentActions: ['prepared_takedown'],
    outcome: 'submitted_for_review',
    evidenceStatus: 'complete',
  };
}

test('a full evidence pack scores 1.0 and is complete', () => {
  const c = evidenceCompleteness(fullPack());
  assert.equal(c.complete, true);
  assert.equal(c.score, 1);
  assert.deepEqual(c.missing, []);
});

test('a missing field is reported and lowers the score', () => {
  const pack = fullPack();
  pack.humanDecision = undefined;
  pack.containmentActions = [];
  const c = evidenceCompleteness(pack);
  assert.equal(c.complete, false);
  assert.ok(c.missing.includes('humanDecision'));
  assert.ok(c.missing.includes('containmentActions'));
  assert.ok(c.score < 1);
});
