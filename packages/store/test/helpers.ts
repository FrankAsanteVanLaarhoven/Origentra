import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  generateKeyPair,
  issueIdentity,
  createPassport,
  evaluatePolicy,
  approve,
  authorize,
  TrustStore,
  type ExecuteParams,
} from '../../core/src/index.ts';

export const T0 = '2026-07-18T10:00:00.000Z';

export function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'origentra-store-'));
}

/** A valid, low-risk ALLOW scenario that authorises without human approval. */
export function scenario(assetText: string, tenantId = 'tenant-1') {
  const authority = generateKeyPair();
  const trust = new TrustStore().add(authority.keyId, authority.publicKeyPem);
  const creator = issueIdentity(
    { identityId: 'u1', tenantId, subjectType: 'person', displayName: 'u1', scopes: ['publish:propose'], issuedAt: T0 },
    authority,
  );
  const passport = createPassport(
    assetText,
    { assetId: 'asset-1', tenantId, contentType: 'text/plain', createdAt: T0, creatorIdentityId: 'u1', aiInvolvement: 'none', rights: [{ kind: 'ownership', holder: 'u1' }] },
    authority,
  );
  const decision = evaluatePolicy(
    { proposalId: 'p1', tenantId, identity: creator, passport, assetBytes: assetText, platform: 'local', audience: 'internal', rightsRequirement: { required: ['ownership'] }, aiDisclosed: false },
    { trustStore: trust, now: T0 },
  );
  const authorization = authorize(decision, [], { trustStore: trust, now: T0, approverIdentities: {} });
  return { authority, trust, creator, passport, decision, authorization };
}

export function executeParams(
  s: ReturnType<typeof scenario>,
  assetText: string,
  idempotencyKey = 'k1',
): ExecuteParams {
  return {
    decision: s.decision,
    authorization: s.authorization,
    platform: 'local',
    assetId: 'asset-1',
    idempotencyKey,
    now: T0,
    executionKey: generateKeyPair(),
    record: {
      passport: s.passport,
      assetBase64: Buffer.from(assetText, 'utf8').toString('base64'),
      contentType: 'text/plain',
    },
  };
}

export { approve };
