/**
 * Origentra Identity — signed identity claims.
 *
 * An identity claim binds a subject (person, organisation, device or AI agent)
 * to a tenant and a set of scopes. Claims are signed so that a relying party
 * can verify authority without contacting the issuer. Verification checks the
 * signature, expiry, revocation and (optionally) whether the signer is trusted.
 *
 * LIMITATION: issuing a claim asserts identity; it does not *prove* real-world
 * identity. Real assurance requires an external verification step (document
 * check, domain control, social-account proof). Origentra records the assurance
 * evidence; this module handles the cryptographic binding only.
 */

import { canonicalBytes } from './canonical.ts';
import { sign, verify, signerRef, type KeyPair } from './keys.ts';
import type { IdentityClaim, SignedIdentityClaim } from './types.ts';
import type { TrustStore } from './trust.ts';

export interface IdentityInput {
  identityId: string;
  tenantId: string;
  subjectType: IdentityClaim['subjectType'];
  displayName: string;
  scopes: string[];
  issuedAt: string;
  expiresAt?: string;
}

export function issueIdentity(input: IdentityInput, issuer: KeyPair): SignedIdentityClaim {
  const claim: IdentityClaim = {
    schema: 'origentra.identity/1',
    identityId: input.identityId,
    tenantId: input.tenantId,
    subjectType: input.subjectType,
    displayName: input.displayName,
    scopes: [...input.scopes],
    issuedAt: input.issuedAt,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
  };
  const signature = sign(issuer.privateKeyPem, canonicalBytes(claim));
  return { claim, signer: signerRef(issuer), signature };
}

export function revokeIdentity(
  signed: SignedIdentityClaim,
  revokedAt: string,
  reason: string,
  issuer: KeyPair,
): SignedIdentityClaim {
  const claim: IdentityClaim = { ...signed.claim, revocation: { revokedAt, reason } };
  const signature = sign(issuer.privateKeyPem, canonicalBytes(claim));
  return { claim, signer: signerRef(issuer), signature };
}

export interface IdentityVerification {
  valid: boolean;
  signatureValid: boolean;
  expired: boolean;
  revoked: boolean;
  signerTrusted: boolean;
  reasons: string[];
}

export function verifyIdentity(
  signed: SignedIdentityClaim,
  opts: { now: string; trustStore?: TrustStore } = { now: new Date().toISOString() },
): IdentityVerification {
  const reasons: string[] = [];
  const signatureValid = verify(
    signed.signer.publicKeyPem,
    canonicalBytes(signed.claim),
    signed.signature,
  );
  if (!signatureValid) reasons.push('signature_invalid');

  const revoked = !!signed.claim.revocation;
  if (revoked) reasons.push('revoked');

  const expired = !!signed.claim.expiresAt && signed.claim.expiresAt <= opts.now;
  if (expired) reasons.push('expired');

  const signerTrusted = !!opts.trustStore && opts.trustStore.has(signed.signer.keyId);
  if (opts.trustStore && !signerTrusted) reasons.push('signer_untrusted');

  const valid = signatureValid && !revoked && !expired;
  return { valid, signatureValid, expired, revoked, signerTrusted, reasons };
}

export function hasScope(claim: IdentityClaim, scope: string): boolean {
  return claim.scopes.includes(scope);
}
