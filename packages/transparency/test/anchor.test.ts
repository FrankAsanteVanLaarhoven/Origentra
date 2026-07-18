import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TransparencyLog, FileAnchor, verifyAnchor } from '../src/index.ts';
import { generateKeyPair, TrustStore } from '../../core/src/index.ts';

const T0 = '2026-07-19T00:00:00.000Z';
function tempFile(): string {
  return join(mkdtempSync(join(tmpdir(), 'origentra-anchor-')), 'anchors.jsonl');
}

test('a checkpoint root is anchored, verifies under trust, and persists', () => {
  const key = generateKeyPair();
  const trust = new TrustStore().add(key.keyId, key.publicKeyPem);
  const log = new TransparencyLog();
  for (let i = 0; i < 5; i++) log.append(`e-${i}`);
  const cp = log.checkpoint(key);

  const file = tempFile();
  const a = new FileAnchor(file).anchor(cp, T0, key);
  assert.equal(verifyAnchor(a, trust), true);
  assert.equal(verifyAnchor(a, new TrustStore()), false, 'untrusted anchorer');
  assert.equal(verifyAnchor({ ...a, rootHash: 'ff'.repeat(32) }, trust), false, 'tampered root');

  const reopened = new FileAnchor(file);
  assert.equal(reopened.list().length, 1);
  const found = reopened.find(cp.logId, cp.size);
  assert.ok(found);
  assert.equal(found.rootHash, cp.rootHash);
});
