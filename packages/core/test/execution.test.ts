import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPassport,
  evaluatePolicy,
  approve,
  authorize,
  SimulatedAdapter,
  verifyReceipt,
  generateKeyPair,
  type PolicyInput,
  type SignedIdentityClaim,
} from '../src/index.ts';
import { makeWorld, makeIdentity, T0, T1 } from './helpers.ts';

const ASSET = 'Content requiring human approval before publication. '.repeat(20);

function highRiskScene(principalType: 'person' | 'agent' = 'agent') {
  const world = makeWorld();
  const principal = makeIdentity(world, {
    identityId: 'agent-1',
    tenantId: 'tenant-1',
    subjectType: principalType,
    scopes: ['publish:propose'],
  });
  const approver = makeIdentity(world, {
    identityId: 'human-approver',
    tenantId: 'tenant-1',
    subjectType: 'person',
    scopes: ['publish:approve'],
  });
  const passport = createPassport(
    ASSET,
    {
      assetId: 'asset-1',
      tenantId: 'tenant-1',
      contentType: 'text/plain',
      createdAt: T0,
      creatorIdentityId: 'agent-1',
      aiInvolvement: 'fully_synthetic',
      rights: [{ kind: 'ownership', holder: 'tenant-1' }],
    },
    world.issuerKey,
  );
  const input: PolicyInput = {
    proposalId: 'p1',
    tenantId: 'tenant-1',
    identity: principal,
    passport,
    assetBytes: ASSET,
    platform: 'youtube',
    audience: 'public',
    rightsRequirement: { required: ['ownership'] },
    aiDisclosed: true,
  };
  const ctx = { trustStore: world.trust, now: T0 };
  const decision = evaluatePolicy(input, ctx);
  return { world, principal, approver, passport, input, ctx, decision };
}

test('REQUIRE_APPROVAL is not authorised without approvals', () => {
  const { decision, ctx } = highRiskScene();
  assert.equal(decision.decision, 'REQUIRE_APPROVAL');
  const auth = authorize(decision, [], { ...ctx, approverIdentities: {} });
  assert.equal(auth.authorized, false);
});

test('a valid human approval authorises execution', () => {
  const { decision, approver, world, ctx } = highRiskScene();
  // Approver signs with a key trusted for identities; use issuerKey as the
  // approver's operational key (its keyId is in the trust store).
  const approval = approve(decision, approver, world.issuerKey, T1);
  const auth = authorize(decision, [approval], {
    ...ctx,
    approverIdentities: { 'human-approver': approver },
  });
  assert.equal(auth.authorized, true);
  assert.equal(auth.acceptedApprovals, 1);
});

test('an AI agent can never be a valid approver', () => {
  const { decision, world, ctx } = highRiskScene();
  const agentApprover: SignedIdentityClaim = makeIdentity(makeWorldFrom(world), {
    identityId: 'rogue-agent',
    tenantId: 'tenant-1',
    subjectType: 'agent',
    scopes: ['publish:approve'],
  });
  const approval = approve(decision, agentApprover, world.issuerKey, T1);
  const auth = authorize(decision, [approval], {
    ...ctx,
    approverIdentities: { 'rogue-agent': agentApprover },
  });
  assert.equal(auth.authorized, false);
  assert.ok(auth.reasons.includes('agent_cannot_approve'));
});

test('an approval for a different decision is rejected (stale/forged binding)', () => {
  const { decision, approver, world, ctx } = highRiskScene();
  const approval = approve(decision, approver, world.issuerKey, T1);
  const otherDecision = { ...decision, risk: decision.risk + 1 }; // changes the digest
  const auth = authorize(otherDecision, [approval], {
    ...ctx,
    approverIdentities: { 'human-approver': approver },
  });
  assert.equal(auth.authorized, false);
  assert.ok(auth.reasons.includes('approval_stale_decision'));
});

test('execution is idempotent: same key -> same receipt, one side effect', () => {
  const { decision, approver, world, ctx } = highRiskScene();
  const approval = approve(decision, approver, world.issuerKey, T1);
  const auth = authorize(decision, [approval], {
    ...ctx,
    approverIdentities: { 'human-approver': approver },
  });
  const adapter = new SimulatedAdapter();
  const execKey = generateKeyPair();
  const p = {
    decision,
    authorization: auth,
    platform: 'youtube',
    assetId: 'asset-1',
    idempotencyKey: 'idem-123',
    now: T1,
    executionKey: execKey,
  };
  const r1 = adapter.execute(p);
  const r2 = adapter.execute(p);
  assert.deepEqual(r1, r2);
  assert.equal(r1.status, 'executed');
  assert.equal(verifyReceipt(r1), true);
});

test('a BLOCKed decision cannot be executed as published', () => {
  const { decision, ctx } = highRiskScene();
  const blocked = { ...decision, decision: 'BLOCK' as const };
  const auth = authorize(blocked, [], { ...ctx, approverIdentities: {} });
  assert.equal(auth.authorized, false);
  const adapter = new SimulatedAdapter();
  const receipt = adapter.execute({
    decision: blocked,
    authorization: auth,
    platform: 'youtube',
    assetId: 'asset-1',
    idempotencyKey: 'idem-block',
    now: T1,
    executionKey: generateKeyPair(),
  });
  assert.equal(receipt.status, 'blocked');
  assert.equal(receipt.externalRef, '');
});

// helper: reuse an existing world's issuer/trust so identities stay verifiable
function makeWorldFrom(world: ReturnType<typeof makeWorld>) {
  return world;
}
