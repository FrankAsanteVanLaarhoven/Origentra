import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { PublishStore, LocalPublishAdapter } from '../src/index.ts';
import { verifyReceipt } from '../../core/src/index.ts';
import { tempDir, scenario, executeParams } from './helpers.ts';

const ASSET = 'Real content published to the local Origentra store. '.repeat(10);

test('local adapter really persists a published record and a signed receipt', () => {
  const dir = tempDir();
  const store = new PublishStore(join(dir, 'published.jsonl'));
  const adapter = new LocalPublishAdapter(join(dir, 'receipts'), store);
  const s = scenario(ASSET);
  const params = executeParams(s, ASSET);

  const receipt = adapter.execute(params);
  assert.equal(receipt.status, 'executed');
  assert.equal(receipt.adapter, 'local-fs/1');
  assert.equal(verifyReceipt(receipt), true);

  const rec = store.getByDigest(s.passport.manifest.digest);
  assert.ok(rec, 'published record should exist');
  assert.equal(rec.assetId, 'asset-1');
  assert.equal(Buffer.from(rec.assetBase64, 'base64').toString('utf8'), ASSET);
});

test('execution is idempotent across separate adapter instances (durable receipt)', () => {
  const dir = tempDir();
  const store = new PublishStore(join(dir, 'published.jsonl'));
  const s = scenario(ASSET);
  const params = executeParams(s, ASSET, 'idem-durable');

  const r1 = new LocalPublishAdapter(join(dir, 'receipts'), store).execute(params);
  // A brand-new adapter instance (simulating a restart) must return the same receipt.
  const r2 = new LocalPublishAdapter(join(dir, 'receipts'), new PublishStore(join(dir, 'published.jsonl'))).execute(params);
  assert.deepEqual(r1, r2);

  // And only one published record exists.
  const reopened = new PublishStore(join(dir, 'published.jsonl'));
  assert.equal(reopened.list().length, 1);
});

test('an unauthorised execution records status=blocked and publishes nothing', () => {
  const dir = tempDir();
  const store = new PublishStore(join(dir, 'published.jsonl'));
  const adapter = new LocalPublishAdapter(join(dir, 'receipts'), store);
  const s = scenario(ASSET);
  const params = executeParams(s, ASSET, 'idem-blocked');
  params.authorization = { authorized: false, reasons: ['test_denied'], acceptedApprovals: 0 };

  const receipt = adapter.execute(params);
  assert.equal(receipt.status, 'blocked');
  assert.equal(receipt.externalRef, '');
  assert.equal(store.list().length, 0);
});
