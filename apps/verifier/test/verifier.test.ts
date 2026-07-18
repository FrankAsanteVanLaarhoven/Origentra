import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createVerifier } from '../server.ts';
import { PublishStore, LocalPublishAdapter } from '../../../packages/store/src/index.ts';
import { createPassport, generateKeyPair } from '../../../packages/core/src/index.ts';
import { tempDir, scenario, executeParams } from '../../../packages/store/test/helpers.ts';

const ASSET = 'Content published then verified over HTTP by Origentra Verify. '.repeat(8);

async function withServer(publishFile: string, fn: (base: string) => Promise<void>) {
  const server = createVerifier(publishFile);
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as AddressInfo).port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

function seedPublished(dir: string) {
  const file = join(dir, 'published.jsonl');
  const store = new PublishStore(file);
  const adapter = new LocalPublishAdapter(join(dir, 'receipts'), store);
  const s = scenario(ASSET);
  adapter.execute(executeParams(s, ASSET));
  return { file, passport: s.passport };
}

test('health and published listing', async () => {
  const { file } = seedPublished(tempDir());
  await withServer(file, async (base) => {
    assert.equal((await (await fetch(base + '/health')).json()).ok, true);
    const list = (await (await fetch(base + '/api/published')).json()).published;
    assert.equal(list.length, 1);
    assert.equal(list[0].assetId, 'asset-1');
  });
});

test('POST /api/verify on published content: valid, trusted, provenance recovered', async () => {
  const { file, passport } = seedPublished(tempDir());
  await withServer(file, async (base) => {
    const res = await fetch(base + '/api/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ passport, assetBase64: Buffer.from(ASSET).toString('base64') }),
    });
    const out = await res.json();
    assert.ok(out.states.includes('SIGNATURE_VALID'));
    assert.ok(out.states.includes('SIGNER_TRUSTED'), 'publisher signer is vouched for by this instance');
    assert.ok(out.states.includes('PROVENANCE_RECOVERED'));
  });
});

test('a passport from an unknown signer is SIGNER_UNKNOWN (honest trust anchor)', async () => {
  const { file } = seedPublished(tempDir());
  const stranger = createPassport(
    'unrelated asset',
    { assetId: 'x', tenantId: 't', contentType: 'text/plain', createdAt: '2026-07-18T10:00:00.000Z', creatorIdentityId: 'c', aiInvolvement: 'none' },
    generateKeyPair(),
  );
  await withServer(file, async (base) => {
    const res = await fetch(base + '/api/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ passport: stranger, assetBase64: Buffer.from('unrelated asset').toString('base64') }),
    });
    const out = await res.json();
    assert.ok(out.states.includes('SIGNER_UNKNOWN'));
    assert.ok(out.states.includes('VERIFICATION_INCOMPLETE'));
  });
});
