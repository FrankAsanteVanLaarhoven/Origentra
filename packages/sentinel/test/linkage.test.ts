import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LinkageGraph, signLinkage } from '../src/index.ts';
import { generateKeyPair, TrustStore, type KeyPair } from '../../core/src/index.ts';

const T0 = '2026-07-19T00:00:00.000Z';

function edge(key: KeyPair, a: string, b: string, confidence: number) {
  return signLinkage({ a, b, basis: 'reused_passport', evidenceRef: `sha256:${a}${b}`, confidence, assertedAt: T0 }, key);
}

test('a cluster follows high-confidence edges but stops at low-confidence ones', () => {
  const key = generateKeyPair();
  const trust = new TrustStore().add(key.keyId, key.publicKeyPem);
  const g = new LinkageGraph(trust);
  g.add(edge(key, 'A', 'B', 0.9));
  g.add(edge(key, 'B', 'C', 0.8));
  g.add(edge(key, 'C', 'D', 0.3)); // weak link — should not extend the cluster

  assert.deepEqual(g.cluster('A', 0.5), ['A', 'B', 'C']);
  assert.deepEqual(g.cluster('A', 0.85), ['A', 'B']);
  assert.deepEqual(g.cluster('D', 0.5), ['D']); // isolated at this threshold
});

test('untrusted linkage edges are rejected', () => {
  const key = generateKeyPair();
  const trust = new TrustStore().add(key.keyId, key.publicKeyPem);
  const g = new LinkageGraph(trust);
  const stranger = generateKeyPair();
  assert.equal(g.add(edge(stranger, 'X', 'Y', 0.9)), false);
  assert.equal(g.edgeCount, 0);
  assert.deepEqual(g.cluster('X'), ['X']);
});
