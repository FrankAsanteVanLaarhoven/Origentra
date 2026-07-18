import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HttpPublishAdapter,
  StaticTokenProvider,
  OAuth2ClientCredentialsProvider,
  AdapterError,
  createLinkedInAdapter,
} from '../src/index.ts';
import { verifyReceipt, type ExecuteParams } from '../../core/src/index.ts';
import { scenario, executeParams } from '../../store/test/helpers.ts';
import { startMockPlatform, type MockPlatform } from './mock-platform.ts';

const ASSET = 'Content published over a real HTTP transport to a mock platform.';

function params(key = 'idem-1'): ExecuteParams {
  return executeParams(scenario(ASSET), ASSET, key);
}

function adapter(mock: MockPlatform, over: Partial<ConstructorParameters<typeof HttpPublishAdapter>[0]> = {}) {
  return new HttpPublishAdapter({
    endpoint: mock.base + '/publish',
    tokenProvider: new StaticTokenProvider('good-token'),
    baseDelayMs: 1,
    maxRetries: 3,
    ...over,
  });
}

async function withMock(fn: (m: MockPlatform) => Promise<void>) {
  const m = await startMockPlatform();
  try {
    await fn(m);
  } finally {
    await m.close();
  }
}

test('successful publish signs an executed receipt with the platform id', async () => {
  await withMock(async (m) => {
    m.state.expectedToken = 'good-token';
    const receipt = await adapter(m).execute(params());
    assert.equal(receipt.status, 'executed');
    assert.match(receipt.externalRef, /^http:\/\/.+\/post-1$/);
    assert.equal(verifyReceipt(receipt), true);
    assert.equal(m.state.publishCalls[0]!.auth, 'Bearer good-token');
    assert.equal(m.state.publishCalls[0]!.key, 'idem-1');
  });
});

test('retries transient 5xx then succeeds', async () => {
  await withMock(async (m) => {
    m.state.failures.push({ status: 503 }, { status: 502 });
    const receipt = await adapter(m).execute(params());
    assert.equal(receipt.status, 'executed');
    assert.equal(m.state.publishCalls.length, 3);
  });
});

test('honours 429 rate limiting then succeeds', async () => {
  await withMock(async (m) => {
    m.state.failures.push({ status: 429, retryAfter: '0' });
    const receipt = await adapter(m).execute(params());
    assert.equal(receipt.status, 'executed');
    assert.equal(m.state.publishCalls.length, 2);
  });
});

test('exhausted 5xx raises a categorised outage error', async () => {
  await withMock(async (m) => {
    m.state.failures.push({ status: 503 }, { status: 503 });
    const a = adapter(m, { maxRetries: 1 });
    await assert.rejects(a.execute(params()), (e: unknown) => e instanceof AdapterError && e.category === 'outage');
  });
});

test('auth failure raises an auth error (no fake receipt)', async () => {
  await withMock(async (m) => {
    m.state.expectedToken = 'the-right-token';
    const a = adapter(m, { tokenProvider: new StaticTokenProvider('the-wrong-token') });
    await assert.rejects(a.execute(params()), (e: unknown) => e instanceof AdapterError && e.category === 'auth');
  });
});

test('an unauthorised policy decision makes no network call', async () => {
  await withMock(async (m) => {
    const p = params();
    p.authorization = { authorized: false, reasons: ['policy_block'], acceptedApprovals: 0 };
    const receipt = await adapter(m).execute(p);
    assert.equal(receipt.status, 'blocked');
    assert.equal(m.state.publishCalls.length, 0);
  });
});

test('idempotent: same key is de-duplicated by the platform (one post minted)', async () => {
  await withMock(async (m) => {
    const a = adapter(m);
    const r1 = await a.execute(params('same-key'));
    const r2 = await a.execute(params('same-key'));
    assert.equal(r1.externalRef, r2.externalRef);
    assert.equal(m.state.counter, 1, 'platform minted exactly one post id');
  });
});

test('per-request timeout aborts and surfaces a timeout error', async () => {
  await withMock(async (m) => {
    m.state.failures.push({ status: 200, delayMs: 120 });
    const a = adapter(m, { timeoutMs: 15, maxRetries: 0 });
    await assert.rejects(a.execute(params()), (e: unknown) => e instanceof AdapterError && e.category === 'timeout');
  });
});

test('OAuth2 client-credentials token is fetched once and cached', async () => {
  await withMock(async (m) => {
    m.state.accessToken = 'issued-token';
    m.state.expectedToken = 'issued-token';
    const provider = new OAuth2ClientCredentialsProvider({ tokenUrl: m.base + '/token', clientId: 'cid', clientSecret: 'secret' });
    const t1 = await provider.getToken();
    const t2 = await provider.getToken();
    assert.equal(t1, 'issued-token');
    assert.equal(t2, 'issued-token');
    assert.equal(m.state.tokenCalls, 1, 'token cached, not re-fetched');

    const receipt = await adapter(m, { tokenProvider: provider }).execute(params());
    assert.equal(receipt.status, 'executed');
  });
});

test('LinkedIn adapter maps to the UGC ShareContent body', async () => {
  await withMock(async (m) => {
    m.state.expectedToken = 'li-token';
    const a = createLinkedInAdapter({
      authorUrn: 'urn:li:person:123',
      tokenProvider: new StaticTokenProvider('li-token'),
      endpoint: m.base + '/publish',
      maxRetries: 0,
    });
    const receipt = await a.execute(params());
    assert.equal(receipt.status, 'executed');
    assert.match(receipt.externalRef, /^linkedin:\/\//);
    const body = m.state.publishCalls[0]!.body as {
      author: string;
      lifecycleState: string;
      specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: string } } };
    };
    assert.equal(body.author, 'urn:li:person:123');
    assert.equal(body.lifecycleState, 'PUBLISHED');
    assert.equal(body.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text, ASSET);
  });
});
