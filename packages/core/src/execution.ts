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
import type { SignedIdentityClaim, Passport } from './types.ts';
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
    if (idClaim.claim.tenantId !== decision.tenantId) {
      // Tenant isolation: an approver may only authorise their own tenant.
      reasons.push('approver_wrong_tenant');
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

/** Optional publishable payload; adapters that persist output use it. */
export interface PublishableRecord {
  passport: Passport;
  assetBase64: string;
  contentType: string;
}

export interface ExecuteParams {
  decision: PolicyDecision;
  authorization: Authorization;
  platform: string;
  assetId: string;
  idempotencyKey: string;
  now: string;
  executionKey: KeyPair;
  /** Content to publish; required by persisting adapters, ignored by simulated. */
  record?: PublishableRecord;
}

/**
 * The contract every platform adapter implements (simulated, local or network).
 * Network adapters are asynchronous, so execute() may return a Promise.
 */
export interface PublicationAdapter {
  readonly name: string;
  execute(params: ExecuteParams): ExecutionReceipt | Promise<ExecutionReceipt>;
}

export interface ReceiptOptions {
  /** Scheme for a locally-derived externalRef when no explicit ref is given. */
  scheme?: string;
  /** External reference returned by a real platform (used verbatim). */
  externalRef?: string;
  /** Override status; defaults to authorization.authorized ? executed : blocked. */
  status?: ExecutionReceipt['status'];
}

/**
 * Build and sign an execution receipt. Shared by every adapter so the receipt
 * shape and signature are identical regardless of where the side effect lands.
 * A real platform passes its returned id via `externalRef`; local adapters pass
 * a `scheme` and the ref is derived deterministically from the idempotency key.
 */
export function buildReceipt(
  params: ExecuteParams,
  adapterName: string,
  opts: ReceiptOptions = {},
): ExecutionReceipt {
  const status: ExecutionReceipt['status'] =
    opts.status ?? (params.authorization.authorized ? 'executed' : 'blocked');
  const externalRef =
    status === 'executed'
      ? opts.externalRef ??
        (opts.scheme ?? 'ref') + '://' + params.platform + '/' + sha256(params.idempotencyKey).slice(7, 23)
      : '';
  const body = {
    proposalId: params.decision.proposalId,
    decisionDigest: decisionDigest(params.decision),
    platform: params.platform,
    assetId: params.assetId,
    idempotencyKey: params.idempotencyKey,
    status,
    externalRef,
    executedAt: params.now,
    adapter: adapterName,
  };
  const signature = sign(params.executionKey.privateKeyPem, canonicalBytes(body));
  return {
    ...body,
    signer: { keyId: params.executionKey.keyId, publicKeyPem: params.executionKey.publicKeyPem },
    signature,
  };
}

/**
 * A simulated platform adapter. It performs no real network I/O; it records an
 * idempotent, signed receipt in memory. Real network adapters (LinkedIn,
 * YouTube, ...) require credentials and are a later milestone; a real *local*
 * persisting adapter lives in @origentra/store. Nothing here claims to have
 * published to a real third-party platform.
 */
export class SimulatedAdapter implements PublicationAdapter {
  readonly name = 'simulated/1';
  private readonly receipts = new Map<string, ExecutionReceipt>();

  execute(params: ExecuteParams): ExecutionReceipt {
    const existing = this.receipts.get(params.idempotencyKey);
    if (existing) return existing; // idempotent: side effect happens at most once
    const receipt = buildReceipt(params, this.name, { scheme: 'sim' });
    this.receipts.set(params.idempotencyKey, receipt);
    return receipt;
  }
}

export function verifyReceipt(receipt: ExecutionReceipt): boolean {
  const { signer, signature, ...body } = receipt;
  return verifySig(signer.publicKeyPem, canonicalBytes(body), signature);
}
