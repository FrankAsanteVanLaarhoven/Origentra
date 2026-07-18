import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuditLog, GENESIS_HASH } from '../src/index.ts';

let clock = 0;
function fixedClock() {
  clock += 1;
  return `2026-07-18T10:00:0${clock}.000Z`;
}

test('empty log head is genesis', () => {
  const log = new AuditLog(() => '2026-07-18T10:00:00.000Z');
  assert.equal(log.head, GENESIS_HASH);
  assert.equal(log.verify().ok, true);
});

test('chain links entries and verifies', () => {
  clock = 0;
  const log = new AuditLog(fixedClock);
  log.append('u1', 'asset.register', 'asset-1', { digest: 'sha256:aaa' });
  log.append('u1', 'passport.sign', 'asset-1', { keyId: 'key:1' });
  log.append('policy', 'publish.evaluate', 'p1', { decision: 'ALLOW' });
  assert.equal(log.list().length, 3);
  assert.equal(log.verify().ok, true);
  assert.equal(log.list()[0]!.prevHash, GENESIS_HASH);
  assert.equal(log.list()[1]!.prevHash, log.list()[0]!.entryHash);
});

test('tampering with a historical entry breaks the chain', () => {
  clock = 0;
  const log = new AuditLog(fixedClock);
  log.append('u1', 'asset.register', 'asset-1', { digest: 'sha256:aaa' });
  log.append('u1', 'passport.sign', 'asset-1', { keyId: 'key:1' });
  log.append('policy', 'publish.evaluate', 'p1', { decision: 'ALLOW' });

  // Mutate entry 1's recorded action after the fact.
  const entries = log.list() as unknown as { action: string }[];
  entries[1]!.action = 'passport.forge';

  const v = log.verify();
  assert.equal(v.ok, false);
  assert.equal(v.brokenAt, 1);
});

test('re-ordering entries breaks the chain', () => {
  clock = 0;
  const log = new AuditLog(fixedClock);
  log.append('a', 'x', 's', {});
  log.append('b', 'y', 's', {});
  const entries = log.list() as unknown as unknown[];
  const tmp = entries[0];
  entries[0] = entries[1]!;
  entries[1] = tmp!;
  assert.equal(log.verify().ok, false);
});
