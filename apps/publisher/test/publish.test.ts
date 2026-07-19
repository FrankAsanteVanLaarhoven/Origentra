import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGovernedPublish, governedContext } from '../publish.ts';
import { createLinkedInAdapter, StaticTokenProvider } from '../../../packages/adapters/src/index.ts';
import { startMockPlatform } from '../../../packages/adapters/test/mock-platform.ts';

const T0 = '2026-07-19T00:00:00.000Z';

interface UgcBody {
  author: string;
  specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: string } } };
}

test('governed publish through the real LinkedIn adapter (vs a mock platform) succeeds', async () => {
  const mock = await startMockPlatform();
  try {
    mock.state.expectedToken = 'tok';
    const ctx = governedContext(T0);
    const adapter = createLinkedInAdapter({ authorUrn: 'urn:li:person:123', tokenProvider: new StaticTokenProvider('tok'), endpoint: mock.base + '/publish', maxRetries: 0 });
    const result = await runGovernedPublish({
      ...ctx,
      assetBytes: 'Hello from Origentra',
      contentType: 'text/plain',
      assetId: 'a1',
      aiInvolvement: 'none',
      aiDisclosed: false,
      rights: [{ kind: 'ownership', holder: 'publisher' }],
      rightsRequired: ['ownership'],
      platform: 'linkedin',
      audience: 'public',
      proposalId: 'p1',
      idempotencyKey: 'k1',
      now: T0,
      adapter,
    });
    assert.equal(result.published, true);
    assert.equal(result.receiptValid, true);
    assert.match(result.receipt!.externalRef, /^linkedin:\/\//);

    const body = mock.state.publishCalls[0]!.body as UgcBody;
    assert.equal(body.author, 'urn:li:person:123');
    assert.equal(body.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text, 'Hello from Origentra');
  } finally {
    await mock.close();
  }
});

test('governed publish is BLOCKed on missing rights and makes no network call', async () => {
  const mock = await startMockPlatform();
  try {
    mock.state.expectedToken = 'tok';
    const ctx = governedContext(T0);
    const adapter = createLinkedInAdapter({ authorUrn: 'urn:li:person:123', tokenProvider: new StaticTokenProvider('tok'), endpoint: mock.base + '/publish', maxRetries: 0 });
    const result = await runGovernedPublish({
      ...ctx,
      assetBytes: 'x',
      contentType: 'text/plain',
      assetId: 'a1',
      aiInvolvement: 'none',
      aiDisclosed: false,
      rights: [],
      rightsRequired: ['music_licence'],
      platform: 'linkedin',
      audience: 'public',
      proposalId: 'p1',
      idempotencyKey: 'k2',
      now: T0,
      adapter,
    });
    assert.equal(result.decision.decision, 'BLOCK');
    assert.equal(result.published, false);
    assert.equal(mock.state.publishCalls.length, 0, 'no network call for a blocked decision');
  } finally {
    await mock.close();
  }
});

test('an AI agent proposer cannot self-publish (requires human approval)', async () => {
  const mock = await startMockPlatform();
  try {
    mock.state.expectedToken = 'tok';
    const ctx = governedContext(T0);
    // Swap the proposer for an agent (issued by the same authority) with propose scope.
    const { issueIdentity } = await import('../../../packages/core/src/index.ts');
    const agent = issueIdentity({ identityId: 'svc-agent', tenantId: ctx.tenantId, subjectType: 'agent', displayName: 'Service Agent', scopes: ['publish:propose'], issuedAt: T0 }, ctx.signingKey);
    const adapter = createLinkedInAdapter({ authorUrn: 'urn:li:person:123', tokenProvider: new StaticTokenProvider('tok'), endpoint: mock.base + '/publish', maxRetries: 0 });
    // No approver supplied -> must not publish.
    const noApprover = await runGovernedPublish({
      ...ctx, proposer: agent, approver: undefined, approverKey: undefined,
      assetBytes: 'agent post', contentType: 'text/plain', assetId: 'a1', aiInvolvement: 'none', aiDisclosed: false,
      rights: [{ kind: 'ownership', holder: 'publisher' }], rightsRequired: ['ownership'],
      platform: 'linkedin', audience: 'public', proposalId: 'p1', idempotencyKey: 'k3', now: T0, adapter,
    });
    assert.equal(noApprover.decision.decision, 'REQUIRE_APPROVAL');
    assert.equal(noApprover.published, false);

    // With a human approver -> publishes.
    const approved = await runGovernedPublish({
      ...ctx, proposer: agent,
      assetBytes: 'agent post', contentType: 'text/plain', assetId: 'a1', aiInvolvement: 'none', aiDisclosed: false,
      rights: [{ kind: 'ownership', holder: 'publisher' }], rightsRequired: ['ownership'],
      platform: 'linkedin', audience: 'public', proposalId: 'p1', idempotencyKey: 'k4', now: T0, adapter,
    });
    assert.equal(approved.published, true);
  } finally {
    await mock.close();
  }
});
