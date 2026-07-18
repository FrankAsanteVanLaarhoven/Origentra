import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPassport,
  evaluatePolicy,
  decisionDigest,
  revokeIdentity,
  generateKeyPair,
  type AiInvolvement,
  type PolicyInput,
} from '../src/index.ts';
import type { KeyPair } from '../src/keys.ts';
import { makeWorld, makeIdentity, T0 } from './helpers.ts';

const ASSET = 'A protected publication produced for Origentra tests. '.repeat(20);

function scene(opts: {
  ai?: AiInvolvement;
  aiDisclosed?: boolean;
  audience?: PolicyInput['audience'];
  scopes?: string[];
  subjectType?: 'person' | 'agent';
  passportTenant?: string;
  passportSigner?: KeyPair;
  rightsRequired?: PolicyInput['rightsRequirement']['required'];
  riskFlags?: PolicyInput['riskFlags'];
} = {}) {
  const world = makeWorld();
  const identity = makeIdentity(world, {
    identityId: 'u1',
    tenantId: 'tenant-1',
    subjectType: opts.subjectType ?? 'person',
    scopes: opts.scopes ?? ['publish:propose'],
  });
  const passport = createPassport(
    ASSET,
    {
      assetId: 'asset-1',
      tenantId: opts.passportTenant ?? 'tenant-1',
      contentType: 'text/plain',
      createdAt: T0,
      creatorIdentityId: 'u1',
      aiInvolvement: opts.ai ?? 'none',
      rights: [{ kind: 'ownership', holder: 'u1' }],
    },
    opts.passportSigner ?? world.issuerKey,
  );
  const input: PolicyInput = {
    proposalId: 'p1',
    tenantId: 'tenant-1',
    identity,
    passport,
    assetBytes: ASSET,
    platform: 'youtube',
    audience: opts.audience ?? 'internal',
    rightsRequirement: { required: opts.rightsRequired ?? ['ownership'] },
    aiDisclosed: opts.aiDisclosed ?? false,
    riskFlags: opts.riskFlags,
  };
  return { world, identity, passport, input, ctx: { trustStore: world.trust, now: T0 } };
}

test('low-risk human publication is ALLOWed', () => {
  const { input, ctx } = scene();
  const d = evaluatePolicy(input, ctx);
  assert.equal(d.decision, 'ALLOW');
  assert.ok(d.risk < 3);
  assert.equal(d.blockingReasons.length, 0);
});

test('synthetic + public audience REQUIRES approval', () => {
  const { input, ctx } = scene({ ai: 'fully_synthetic', aiDisclosed: true, audience: 'public' });
  const d = evaluatePolicy(input, ctx);
  assert.equal(d.decision, 'REQUIRE_APPROVAL');
  assert.ok(d.risk >= 3);
  assert.equal(d.requiredApprovals, 1);
});

test('an AI agent principal can never publish directly, even at low risk', () => {
  const { input, ctx } = scene({ subjectType: 'agent', audience: 'internal' });
  const d = evaluatePolicy(input, ctx);
  assert.equal(d.decision, 'REQUIRE_APPROVAL');
  assert.equal(d.principalIsAgent, true);
});

test('cross-tenant asset is BLOCKed (tenant isolation)', () => {
  const { input, ctx } = scene({ passportTenant: 'tenant-2' });
  const d = evaluatePolicy(input, ctx);
  assert.equal(d.decision, 'BLOCK');
  assert.ok(d.blockingReasons.includes('cross_tenant_asset'));
});

test('missing mandatory right BLOCKs (fail closed)', () => {
  const { input, ctx } = scene({ rightsRequired: ['music_licence'] });
  const d = evaluatePolicy(input, ctx);
  assert.equal(d.decision, 'BLOCK');
  assert.ok(d.blockingReasons.some((r) => r.startsWith('rights_missing')));
});

test('untrusted passport signer BLOCKs', () => {
  const stranger = generateKeyPair();
  const { input, ctx } = scene({ passportSigner: stranger });
  const d = evaluatePolicy(input, ctx);
  assert.equal(d.decision, 'BLOCK');
  assert.ok(d.blockingReasons.includes('passport_signer_untrusted'));
});

test('provenance mismatch (bytes != passport) BLOCKs', () => {
  const { input, ctx } = scene();
  const d = evaluatePolicy({ ...input, assetBytes: 'different bytes entirely' }, ctx);
  assert.equal(d.decision, 'BLOCK');
  assert.ok(d.blockingReasons.includes('provenance_digest_mismatch'));
});

test('undisclosed AI-involved content BLOCKs', () => {
  const { input, ctx } = scene({ ai: 'generated', aiDisclosed: false });
  const d = evaluatePolicy(input, ctx);
  assert.equal(d.decision, 'BLOCK');
  assert.ok(d.blockingReasons.includes('ai_disclosure_missing'));
});

test('unknown AI origin BLOCKs', () => {
  const { input, ctx } = scene({ ai: 'unknown' });
  const d = evaluatePolicy(input, ctx);
  assert.equal(d.decision, 'BLOCK');
  assert.ok(d.blockingReasons.includes('ai_origin_unknown'));
});

test('principal missing publish:propose scope BLOCKs', () => {
  const { input, ctx } = scene({ scopes: [] });
  const d = evaluatePolicy(input, ctx);
  assert.equal(d.decision, 'BLOCK');
  assert.ok(d.blockingReasons.includes('identity_missing_scope'));
});

test('revoked principal identity BLOCKs', () => {
  const { world, input, ctx } = scene();
  const revoked = revokeIdentity(input.identity, T0, 'left_company', world.issuerKey);
  const d = evaluatePolicy({ ...input, identity: revoked }, ctx);
  assert.equal(d.decision, 'BLOCK');
  assert.ok(d.blockingReasons.some((r) => r.startsWith('identity_invalid')));
});

test('policy is deterministic: identical inputs produce identical decision digests', () => {
  const { input, ctx } = scene({ ai: 'synthetic_voice', aiDisclosed: true, audience: 'public' });
  const a = evaluatePolicy(input, ctx);
  const b = evaluatePolicy(input, ctx);
  assert.equal(decisionDigest(a), decisionDigest(b));
});
