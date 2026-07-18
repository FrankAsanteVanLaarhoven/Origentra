import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TransparencyLog, verifyInclusionResult } from '../src/index.ts';

function tempFile(): string {
  return join(mkdtempSync(join(tmpdir(), 'origentra-tlog-')), 'log.hexl');
}

test('a durable log survives reconstruction from disk', () => {
  const file = tempFile();
  const log = new TransparencyLog('durable/1', file);
  for (let i = 0; i < 7; i++) log.append(`entry-${i}`);
  const root = log.root();

  const reopened = new TransparencyLog('durable/1', file);
  assert.equal(reopened.size, 7);
  assert.ok(reopened.root().equals(root), 'root reproduced after reload');
  assert.equal(verifyInclusionResult(reopened.inclusionProof(3)), true);
});

test('appends after reload continue the same log', () => {
  const file = tempFile();
  const a = new TransparencyLog('durable/2', file);
  for (let i = 0; i < 3; i++) a.append(`x-${i}`);

  const b = new TransparencyLog('durable/2', file);
  for (let i = 3; i < 6; i++) b.append(`x-${i}`);
  assert.equal(b.size, 6);

  // A fresh full build of the same 6 entries yields the same root.
  const fresh = new TransparencyLog('durable/2');
  for (let i = 0; i < 6; i++) fresh.append(`x-${i}`);
  assert.ok(b.root().equals(fresh.root()));
});
