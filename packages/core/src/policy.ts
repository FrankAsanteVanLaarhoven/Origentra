/**
 * Origentra Control — the deterministic policy engine.
 *
 * This is the core of the platform. An AI agent (or any principal) may PROPOSE
 * a publication; this engine is the independent, deterministic authority that
 * decides whether it may proceed. It never calls a model. Given the same
 * inputs it always returns the same decision. It fails CLOSED: any check that
 * cannot be satisfied results in BLOCK.
 *
 * Decision values:
 *   - BLOCK            : a mandatory check failed; must not publish.
 *   - REQUIRE_APPROVAL : permitted only after a human with publish:approve
 *                        authority signs off (see execution.ts / authorize()).
 *   - ALLOW            : low risk, no approval required.
 *
 * Every decision carries a transparent list of checks and a risk score in
 * [0,6] mapped to explicit factors, so the outcome is auditable and explainable.
 */

import { canonicalBytes } from './canonical.ts';
import { sha256, digestEqual } from './digest.ts';
import { verify as verifySig } from './keys.ts';
import { verifyIdentity, hasScope } from './identity.ts';
import { evaluateRights, type RightsRequirement, type RightsIssue } from './rights.ts';
import type { SignedIdentityClaim, Passport } from './types.ts';
import type { TrustStore } from './trust.ts';

export type Audience = 'public' | 'restricted' | 'internal';

export interface PolicyInput {
  proposalId: string;
  tenantId: string;
  /** The principal proposing the action (a person or an AI agent). */
  identity: SignedIdentityClaim;
  passport: Passport;
  /** Bytes being published — checked against the passport for provenance. */
  assetBytes: Buffer | Uint8Array | string;
  platform: string;
  audience: Audience;
  rightsRequirement: RightsRequirement;
  /** Whether the required machine-readable AI disclosure is attached. */
  aiDisclosed: boolean;
  riskFlags?: { regulatedClaim?: boolean; politicalContent?: boolean };
}

export interface PolicyContext {
  trustStore: TrustStore;
  now: string;
}

export type Decision = 'ALLOW' | 'REQUIRE_APPROVAL' | 'BLOCK';

export interface PolicyCheck {
  name: string;
  status: 'pass' | 'fail' | 'na';
  detail: string;
}

export interface PolicyDecision {
  proposalId: string;
  /** Tenant the decision belongs to; approvals must come from this tenant. */
  tenantId: string;
  decision: Decision;
  /** Risk in [0,6] with the factors that produced it. */
  risk: number;
  riskFactors: string[];
  checks: PolicyCheck[];
  blockingReasons: string[];
  requiredApproverScope: 'publish:approve';
  requiredApprovals: number;
  /** Whether the principal is an autonomous agent (never a valid approver). */
  principalIsAgent: boolean;
  evaluatedAt: string;
}

const APPROVAL_THRESHOLD = 3;

export function evaluatePolicy(input: PolicyInput, ctx: PolicyContext): PolicyDecision {
  const checks: PolicyCheck[] = [];
  const blocking: string[] = [];
  const bytes =
    typeof input.assetBytes === 'string'
      ? Buffer.from(input.assetBytes, 'utf8')
      : Buffer.from(input.assetBytes);

  const principalIsAgent = input.identity.claim.subjectType === 'agent';

  // 1. Identity: signature, revocation, expiry, tenant, scope.
  const idv = verifyIdentity(input.identity, { now: ctx.now, trustStore: ctx.trustStore });
  if (!idv.valid) {
    checks.push({ name: 'identity', status: 'fail', detail: idv.reasons.join(',') });
    blocking.push(`identity_invalid:${idv.reasons.join(',')}`);
  } else if (input.identity.claim.tenantId !== input.tenantId) {
    checks.push({ name: 'identity', status: 'fail', detail: 'tenant_mismatch' });
    blocking.push('identity_tenant_mismatch');
  } else if (!hasScope(input.identity.claim, 'publish:propose')) {
    checks.push({ name: 'identity', status: 'fail', detail: 'missing_scope:publish:propose' });
    blocking.push('identity_missing_scope');
  } else {
    checks.push({ name: 'identity', status: 'pass', detail: input.identity.claim.identityId });
  }

  // 2. Tenant isolation: passport belongs to the same tenant.
  if (input.passport.manifest.tenantId !== input.tenantId) {
    checks.push({ name: 'tenant_isolation', status: 'fail', detail: 'passport_tenant_mismatch' });
    blocking.push('cross_tenant_asset');
  } else {
    checks.push({ name: 'tenant_isolation', status: 'pass', detail: input.tenantId });
  }

  // 3. Passport signature + signer trust + revocation.
  const sigOk = verifySig(
    input.passport.signer.publicKeyPem,
    canonicalBytes(input.passport.manifest),
    input.passport.signature,
  );
  const signerTrusted = ctx.trustStore.has(input.passport.signer.keyId);
  if (!sigOk) {
    checks.push({ name: 'passport_signature', status: 'fail', detail: 'invalid' });
    blocking.push('passport_signature_invalid');
  } else if (!signerTrusted) {
    checks.push({ name: 'passport_signature', status: 'fail', detail: 'signer_untrusted' });
    blocking.push('passport_signer_untrusted');
  } else if (input.passport.revocation) {
    checks.push({ name: 'passport_signature', status: 'fail', detail: 'revoked' });
    blocking.push('passport_revoked');
  } else {
    checks.push({ name: 'passport_signature', status: 'pass', detail: input.passport.signer.keyId });
  }

  // 4. Provenance: the bytes being published match the passport digest.
  if (digestEqual(sha256(bytes), input.passport.manifest.digest)) {
    checks.push({ name: 'provenance', status: 'pass', detail: 'exact_digest_match' });
  } else {
    checks.push({ name: 'provenance', status: 'fail', detail: 'digest_mismatch' });
    blocking.push('provenance_digest_mismatch');
  }

  // 5. Rights: fail closed on any missing/expired/revoked/disputed mandatory right.
  const rightsEval = evaluateRights(input.passport.manifest.rights, input.rightsRequirement, ctx.now);
  if (!rightsEval.satisfied) {
    checks.push({
      name: 'rights',
      status: 'fail',
      detail: rightsEval.blocking.map((b: RightsIssue) => `${b.kind}:${b.reason}`).join(','),
    });
    for (const b of rightsEval.blocking) blocking.push(`rights_${b.reason}:${b.kind}`);
  } else {
    checks.push({ name: 'rights', status: 'pass', detail: 'all_required_rights_valid' });
  }

  // 6. AI disclosure: synthetic media must carry a machine-readable disclosure.
  const ai = input.passport.manifest.aiInvolvement;
  const disclosureRequired = ai !== 'none' && ai !== 'unknown';
  if (ai === 'unknown') {
    checks.push({ name: 'ai_disclosure', status: 'fail', detail: 'origin_unknown' });
    blocking.push('ai_origin_unknown');
  } else if (disclosureRequired && !input.aiDisclosed) {
    checks.push({ name: 'ai_disclosure', status: 'fail', detail: `undisclosed:${ai}` });
    blocking.push('ai_disclosure_missing');
  } else {
    checks.push({
      name: 'ai_disclosure',
      status: disclosureRequired ? 'pass' : 'na',
      detail: ai,
    });
  }

  // 7. Risk scoring (0..6), mapped to explicit factors.
  const factors: string[] = [];
  let risk = 0;
  if (ai === 'synthetic_likeness' || ai === 'fully_synthetic') {
    risk += 2;
    factors.push('synthetic_likeness_or_full(+2)');
  }
  if (ai === 'synthetic_voice') {
    risk += 1;
    factors.push('synthetic_voice(+1)');
  }
  if (ai === 'generated') {
    risk += 1;
    factors.push('ai_generated(+1)');
  }
  if (principalIsAgent) {
    risk += 2;
    factors.push('autonomous_agent_principal(+2)');
  }
  if (input.audience === 'public') {
    risk += 1;
    factors.push('public_audience(+1)');
  }
  if (input.rightsRequirement.advertising) {
    risk += 1;
    factors.push('advertising(+1)');
  }
  if (input.riskFlags?.regulatedClaim) {
    risk += 2;
    factors.push('regulated_claim(+2)');
  }
  if (input.riskFlags?.politicalContent) {
    risk += 2;
    factors.push('political_content(+2)');
  }
  risk = Math.min(6, risk);

  // Final decision — fail closed.
  let decision: Decision;
  if (blocking.length > 0) {
    decision = 'BLOCK';
  } else if (risk >= APPROVAL_THRESHOLD || principalIsAgent) {
    // An AI agent may propose but may never publish high-risk content directly;
    // and any proposal at or above the risk threshold needs human sign-off.
    decision = 'REQUIRE_APPROVAL';
  } else {
    decision = 'ALLOW';
  }

  return {
    proposalId: input.proposalId,
    tenantId: input.tenantId,
    decision,
    risk,
    riskFactors: factors,
    checks,
    blockingReasons: blocking,
    requiredApproverScope: 'publish:approve',
    requiredApprovals: decision === 'REQUIRE_APPROVAL' ? 1 : 0,
    principalIsAgent,
    evaluatedAt: ctx.now,
  };
}

/** Stable digest of a decision, used to bind approvals and receipts to it. */
export function decisionDigest(decision: PolicyDecision): string {
  return sha256(canonicalBytes(decision));
}
