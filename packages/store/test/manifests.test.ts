import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { DurableManifestStore } from '../src/index.ts';
import { createPassport, generateKeyPair } from '../../core/src/index.ts';
import { tempDir, T0 } from './helpers.ts';

const ASSET_A = 'Tenant one owns this protected article about Origentra. '.repeat(20);
const ASSET_B = 'Tenant two owns a completely different protected asset here. '.repeat(20);

function mkPassport(text: string, tenantId: string, assetId: string) {
  return createPassport(
    text,
    { assetId, tenantId, contentType: 'text/plain', createdAt: T0, creatorIdentityId: 'c', aiInvolvement: 'none', rights: [{ kind: 'ownership', holder: 'c' }] },
    generateKeyPair(),
  );
}

test('put + getByDigest recovers exactly', () => {
  const store = new DurableManifestStore(join(tempDir(), 'm.jsonl'));
  store.put(mkPassport(ASSET_A, 'tenant-1', 'a1'));
  const p = store.getByDigest(ASSET_A);
  assert.ok(p);
  assert.equal(p.manifest.assetId, 'a1');
});

test('recover is tenant-scoped: tenant-2 cannot recover tenant-1 assets', () => {
  const store = new DurableManifestStore(join(tempDir(), 'm.jsonl'));
  store.put(mkPassport(ASSET_A, 'tenant-1', 'a1'));
  store.put(mkPassport(ASSET_B, 'tenant-2', 'b1'));

  // tenant-1 recovers its own asset (exact)
  const own = store.recover(ASSET_A, 'tenant-1');
  assert.ok(own);
  assert.equal(own.exact, true);

  // tenant-2 presenting tenant-1's exact bytes recovers NOTHING (isolation)
  const cross = store.recover(ASSET_A, 'tenant-2');
  assert.equal(cross, undefined);
});

test('fuzzy recovery works within a tenant for a transformed copy', () => {
  const store = new DurableManifestStore(join(tempDir(), 'm.jsonl'));
  store.put(mkPassport(ASSET_A, 'tenant-1', 'a1'));
  const transformed = ASSET_A.replace('protected article', 'PROTECTED article') + ' extra tail';
  const rec = store.recover(transformed, 'tenant-1', 0.6);
  assert.ok(rec, 'expected fuzzy recovery within tenant');
  assert.equal(rec.exact, false);
});

test('data persists across store instances (durability)', () => {
  const file = join(tempDir(), 'm.jsonl');
  new DurableManifestStore(file).put(mkPassport(ASSET_A, 'tenant-1', 'a1'));
  const reopened = new DurableManifestStore(file);
  assert.equal(reopened.size, 1);
  assert.ok(reopened.getByDigest(ASSET_A));
  assert.equal(reopened.countForTenant('tenant-1'), 1);
});
