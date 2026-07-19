/**
 * Governed publish runner — the go-live path.
 *
 * Drives the complete control loop through ANY PublicationAdapter: build a signed
 * Content Passport, evaluate the deterministic policy, collect a human approval if
 * required, then execute through the adapter and record the signed receipt. The
 * SAME code path runs against the simulated adapter, the local adapter, the mock
 * platform (hermetic tests), or a REAL network adapter (LinkedIn) when given
 * credentials — nothing about going live changes the governance.
 */

import {
  createPassport,
  evaluatePolicy,
  approve,
  authorize,
  verifyReceipt,
  generateKeyPair,
  issueIdentity,
  TrustStore,
  type KeyPair,
  type SignedIdentityClaim,
  type PolicyInput,
  type PolicyDecision,
  type Authorization,
  type PublicationAdapter,
  type ExecutionReceipt,
  type AiInvolvement,
  type RightsRecord,
} from '../../packages/core/src/index.ts';

export interface GovernedPublishInput {
  tenantId: string;
  /** Key that signs the passport (tenant authority). */
  signingKey: KeyPair;
  trust: TrustStore;
  proposer: SignedIdentityClaim;
  /** Required only if the policy returns REQUIRE_APPROVAL. */
  approver?: SignedIdentityClaim;
  approverKey?: KeyPair;

  assetBytes: Buffer | Uint8Array | string;
  contentType: string;
  assetId: string;
  creatorIdentityId: string;
  aiInvolvement: AiInvolvement;
  aiDisclosed: boolean;
  rights?: RightsRecord[];
  rightsRequired?: PolicyInput['rightsRequirement']['required'];

  platform: string;
  audience: PolicyInput['audience'];
  proposalId: string;
  idempotencyKey: string;
  now: string;

  adapter: PublicationAdapter;
  executionKey: KeyPair;
}

export interface GovernedPublishResult {
  decision: PolicyDecision;
  authorization: Authorization;
  receipt: ExecutionReceipt | null;
  receiptValid: boolean;
  published: boolean;
}

export async function runGovernedPublish(input: GovernedPublishInput): Promise<GovernedPublishResult> {
  const bytes = typeof input.assetBytes === 'string' ? Buffer.from(input.assetBytes, 'utf8') : Buffer.from(input.assetBytes);

  const passport = createPassport(
    bytes,
    {
      assetId: input.assetId,
      tenantId: input.tenantId,
      contentType: input.contentType,
      createdAt: input.now,
      creatorIdentityId: input.creatorIdentityId,
      aiInvolvement: input.aiInvolvement,
      rights: input.rights ?? [],
    },
    input.signingKey,
  );

  const proposal: PolicyInput = {
    proposalId: input.proposalId,
    tenantId: input.tenantId,
    identity: input.proposer,
    passport,
    assetBytes: bytes,
    platform: input.platform,
    audience: input.audience,
    rightsRequirement: { required: input.rightsRequired ?? [] },
    aiDisclosed: input.aiDisclosed,
  };

  const ctx = { trustStore: input.trust, now: input.now };
  const decision = evaluatePolicy(proposal, ctx);

  let authorization: Authorization;
  if (decision.decision === 'REQUIRE_APPROVAL') {
    if (!input.approver || !input.approverKey) {
      authorization = { authorized: false, reasons: ['approval_required_but_no_approver_supplied'], acceptedApprovals: 0 };
    } else {
      const approval = approve(decision, input.approver, input.approverKey, input.now);
      authorization = authorize(decision, [approval], {
        trustStore: input.trust,
        now: input.now,
        approverIdentities: { [input.approver.claim.identityId]: input.approver },
      });
    }
  } else {
    authorization = authorize(decision, [], { trustStore: input.trust, now: input.now, approverIdentities: {} });
  }

  const receipt = await input.adapter.execute({
    decision,
    authorization,
    platform: input.platform,
    assetId: input.assetId,
    idempotencyKey: input.idempotencyKey,
    now: input.now,
    executionKey: input.executionKey,
    record: { passport, assetBase64: bytes.toString('base64'), contentType: input.contentType },
  });

  const receiptValid = verifyReceipt(receipt);
  return { decision, authorization, receipt, receiptValid, published: receipt.status === 'executed' && receiptValid };
}

export interface GovernedContext {
  tenantId: string;
  signingKey: KeyPair;
  trust: TrustStore;
  proposer: SignedIdentityClaim;
  approver: SignedIdentityClaim;
  approverKey: KeyPair;
  executionKey: KeyPair;
  creatorIdentityId: string;
}

/** A self-contained single-tenant context (proposer + human approver) for a run. */
export function governedContext(now: string, tenantId = 'tenant-live'): GovernedContext {
  const signingKey = generateKeyPair();
  const trust = new TrustStore().add(signingKey.keyId, signingKey.publicKeyPem);
  const proposer = issueIdentity(
    { identityId: 'publisher', tenantId, subjectType: 'person', displayName: 'Publisher', scopes: ['asset:register', 'publish:propose'], issuedAt: now },
    signingKey,
  );
  const approver = issueIdentity(
    { identityId: 'approver', tenantId, subjectType: 'person', displayName: 'Approver', scopes: ['publish:approve'], issuedAt: now },
    signingKey,
  );
  return { tenantId, signingKey, trust, proposer, approver, approverKey: signingKey, executionKey: generateKeyPair(), creatorIdentityId: 'publisher' };
}
