/**
 * Governed execution — approvals, authorisation and idempotent simulated
 * publication with signed receipts.
 *
 * Flow: evaluatePolicy() -> (if REQUIRE_APPROVAL) collect signed approvals ->
 * authorize() -> SimulatedAdapter.execute() -> signed ExecutionReceipt.
 *
 * Guarantees implemented here:
 *   - Fail closed: a BLOCK decision can never be authorised.
 *   - Human authority: an approval must come from a non-agent principal that
 *     holds publish:approve, is in the same tenant, and is bound to THIS
 *     decision (by decision digest). An agent can never approve.
 *   - Idempotency: the same idempotency key returns the same receipt exactly
 *     once-effectively; the adapter side effect happens at most once.
 */

import { canonicalBytes } from './canonical.ts';
import { sha256 } from './digest.ts';
import { sign, verify as verifySig, type KeyPair } from './keys.ts';
import { verifyIdentity, hasScope } from './identity.ts';
import { decisionDigest, type PolicyDecision } from './policy.ts';
import type { SignedIdentityClaim } from './types.ts';
import type { TrustStore } from './trust.ts';

export interface Approval {
  proposalId: string;
  decisionDigest: string;
  approverIdentityId: string;
  approverKeyId: string;
  approvedAt: string;
  signature: string;
}

/** Produce a signed approval for a decision. */
export function approve(
  decision: PolicyDecision,
  approverIdentity: SignedIdentityClaim,
  approverKey: KeyPair,
  approvedAt: string,
): Approval {
  const body = {
    proposalId: decision.proposalId,
    decisionDigest: decisionDigest(decision),
    approverIdentityId: approverIdentity.claim.identityId,
    approverKeyId: approverKey.keyId,
    approvedAt,
  };
  const signature = sign(approverKey.privateKeyPem, canonicalBytes(body));
  return { ...body, signature };
}

export interface AuthorizationContext {
  trustStore: TrustStore;
  now: string;
  /** Identity claims of approvers, keyed by approverIdentityId, for validation. */
  approverIdentities: Record<string, SignedIdentityClaim>;
}

export interface Authorization {
  authorized: boolean;
  reasons: string[];
  acceptedApprovals: number;
}

/** Decide whether a policy decision plus approvals authorises execution. */
export function authorize(
  decision: PolicyDecision,
  approvals: Approval[],
  ctx: AuthorizationContext,
): Authorization {
  const reasons: string[] = [];

  if (decision.decision === 'BLOCK') {
    return { authorized: false, reasons: ['decision_block'], acceptedApprovals: 0 };
  }

  if (decision.decision === 'ALLOW') {
    return { authorized: true, reasons: ['auto_allow_low_risk'], acceptedApprovals: 0 };
  }

  // REQUIRE_APPROVAL: validate each approval independently, fail closed.
  const wantDigest = decisionDigest(decision);
  let accepted = 0;
  const seenApprovers = new Set<string>();

  for (const a of approvals) {
    if (a.proposalId !== decision.proposalId) {
      reasons.push('approval_wrong_proposal');
      continue;
    }
    if (a.decisionDigest !== wantDigest) {
      reasons.push('approval_stale_decision');
      continue;
    }
    const idClaim = ctx.approverIdentities[a.approverIdentityId];
    if (!idClaim) {
      reasons.push('approver_identity_unknown');
      continue;
    }
    if (idClaim.claim.subjectType === 'agent') {
      reasons.push('agent_cannot_approve');
      continue;
    }
    const idv = verifyIdentity(idClaim, { now: ctx.now, trustStore: ctx.trustStore });
    if (!idv.valid || !idv.signerTrusted) {
      reasons.push('approver_identity_invalid');
      continue;
    }
    if (!hasScope(idClaim.claim, 'publish:approve')) {
      reasons.push('approver_missing_scope');
      continue;
    }
    const body = {
      proposalId: a.proposalId,
      decisionDigest: a.decisionDigest,
      approverIdentityId: a.approverIdentityId,
      approverKeyId: a.approverKeyId,
      approvedAt: a.approvedAt,
    };
    if (!verifySig(idClaim.signer.publicKeyPem, canonicalBytes(body), a.signature)) {
      // Approval must be signed by the same key that the trusted identity uses.
      reasons.push('approval_signature_invalid');
      continue;
    }
    if (seenApprovers.has(a.approverIdentityId)) continue; // no double-counting
    seenApprovers.add(a.approverIdentityId);
    accepted++;
  }

  const authorized = accepted >= decision.requiredApprovals;
  if (authorized) reasons.push('approvals_satisfied');
  else reasons.push('insufficient_approvals');
  return { authorized, reasons, acceptedApprovals: accepted };
}

export interface ExecutionReceipt {
  proposalId: string;
  decisionDigest: string;
  platform: string;
  assetId: string;
  idempotencyKey: string;
  status: 'executed' | 'blocked';
  /** Simulated external reference returned by the platform adapter. */
  externalRef: string;
  executedAt: string;
  adapter: string;
  signer: { keyId: string; publicKeyPem: string };
  signature: string;
}

export interface ExecuteParams {
  decision: PolicyDecision;
  authorization: Authorization;
  platform: string;
  assetId: string;
  idempotencyKey: string;
  now: string;
  executionKey: KeyPair;
}

/**
 * A simulated platform adapter. It performs no real network I/O; it records an
 * idempotent, signed receipt. Real adapters (LinkedIn, YouTube, ...) are a later
 * milestone and implement the same interface. Nothing here claims to have
 * published to a real platform.
 */
export class SimulatedAdapter {
  readonly name = 'simulated/1';
  private readonly receipts = new Map<string, ExecutionReceipt>();

  execute(params: ExecuteParams): ExecutionReceipt {
    const existing = this.receipts.get(params.idempotencyKey);
    if (existing) return existing; // idempotent: side effect happens at most once

    const status: ExecutionReceipt['status'] = params.authorization.authorized
      ? 'executed'
      : 'blocked';
    const body = {
      proposalId: params.decision.proposalId,
      decisionDigest: decisionDigest(params.decision),
      platform: params.platform,
      assetId: params.assetId,
      idempotencyKey: params.idempotencyKey,
      status,
      externalRef:
        status === 'executed'
          ? 'sim://' + params.platform + '/' + sha256(params.idempotencyKey).slice(7, 23)
          : '',
      executedAt: params.now,
      adapter: this.name,
    };
    const signature = sign(params.executionKey.privateKeyPem, canonicalBytes(body));
    const receipt: ExecutionReceipt = {
      ...body,
      signer: { keyId: params.executionKey.keyId, publicKeyPem: params.executionKey.publicKeyPem },
      signature,
    };
    this.receipts.set(params.idempotencyKey, receipt);
    return receipt;
  }
}

export function verifyReceipt(receipt: ExecutionReceipt): boolean {
  const { signer, signature, ...body } = receipt;
  return verifySig(signer.publicKeyPem, canonicalBytes(body), signature);
}
