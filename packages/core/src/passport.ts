/**
 * Origentra Passport — the Content Passport: sign and verify.
 *
 * A passport is a signed manifest describing a protected asset. Verification
 * returns a set of discrete VerificationStates, never a single trust score.
 * The verifier is expected to look at the states and decide for itself what
 * authority to grant.
 */

import { canonicalBytes } from './canonical.ts';
import { sha256, digestEqual } from './digest.ts';
import { fingerprint as makeFingerprint, similarity } from './fingerprint.ts';
import { sign, verify, signerRef, type KeyPair } from './keys.ts';
import type {
  Passport,
  PassportManifest,
  RightsRecord,
  Transformation,
  VerificationResult,
  VerificationState,
  AiInvolvement,
} from './types.ts';
import type { TrustStore } from './trust.ts';

export interface PassportInput {
  assetId: string;
  tenantId: string;
  contentType: string;
  createdAt: string;
  creatorIdentityId: string;
  aiInvolvement: AiInvolvement;
  rights?: RightsRecord[];
  transformations?: Transformation[];
}

/** Build and sign a Content Passport for the given asset bytes. */
export function createPassport(
  bytes: Buffer | Uint8Array | string,
  input: PassportInput,
  signer: KeyPair,
): Passport {
  const buf = typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : Buffer.from(bytes);
  const manifest: PassportManifest = {
    schema: 'origentra.passport/1',
    assetId: input.assetId,
    tenantId: input.tenantId,
    digest: sha256(buf),
    contentType: input.contentType,
    createdAt: input.createdAt,
    creatorIdentityId: input.creatorIdentityId,
    aiInvolvement: input.aiInvolvement,
    rights: input.rights ?? [],
    fingerprints: [makeFingerprint(buf)],
    transformations: input.transformations ?? [],
  };
  const signature = sign(signer.privateKeyPem, canonicalBytes(manifest));
  return {
    manifest,
    signer: signerRef(signer),
    signature,
    signedAt: input.createdAt,
  };
}

export function revokePassport(passport: Passport, revokedAt: string, reason: string): Passport {
  return { ...passport, revocation: { revokedAt, reason } };
}

export interface VerifyOptions {
  trustStore?: TrustStore;
  /** Asset bytes to check provenance recovery against the manifest digest. */
  assetBytes?: Buffer | Uint8Array | string;
  /** Similarity threshold for fuzzy provenance recovery. Default 0.6. */
  fuzzyThreshold?: number;
}

/**
 * Verify a passport and return discrete states.
 *
 * - SIGNATURE_VALID / SIGNATURE_INVALID: integrity of the manifest.
 * - SIGNER_TRUSTED / SIGNER_UNKNOWN: authority of the signer.
 * - CREDENTIAL_REVOKED: the passport was revoked.
 * - PROVENANCE_RECOVERED / ASSET_MODIFIED: only emitted when assetBytes given.
 * - RIGHTS_RECORDED / RIGHTS_DISPUTED: presence/status of rights assertions.
 * - AI_INVOLVEMENT_DECLARED: aiInvolvement is a value other than 'unknown'.
 * - VERIFICATION_INCOMPLETE: signer is not trusted or bytes were not provided.
 */
export function verifyPassport(passport: Passport, opts: VerifyOptions = {}): VerificationResult {
  const states: VerificationState[] = [];
  const signatureValid = verify(
    passport.signer.publicKeyPem,
    canonicalBytes(passport.manifest),
    passport.signature,
  );
  states.push(signatureValid ? 'SIGNATURE_VALID' : 'SIGNATURE_INVALID');

  const signerTrusted = !!opts.trustStore && opts.trustStore.has(passport.signer.keyId);
  states.push(signerTrusted ? 'SIGNER_TRUSTED' : 'SIGNER_UNKNOWN');

  const revoked = !!passport.revocation;
  if (revoked) states.push('CREDENTIAL_REVOKED');

  if (opts.assetBytes !== undefined) {
    const buf =
      typeof opts.assetBytes === 'string'
        ? Buffer.from(opts.assetBytes, 'utf8')
        : Buffer.from(opts.assetBytes);
    const digest = sha256(buf);
    if (digestEqual(digest, passport.manifest.digest)) {
      states.push('PROVENANCE_RECOVERED');
    } else {
      const threshold = opts.fuzzyThreshold ?? 0.6;
      const fp = makeFingerprint(buf);
      const best = Math.max(0, ...passport.manifest.fingerprints.map((m) => similarity(fp, m)));
      states.push(best >= threshold ? 'PROVENANCE_RECOVERED' : 'ASSET_MODIFIED');
    }
  }

  if (passport.manifest.rights.length > 0) {
    states.push('RIGHTS_RECORDED');
    if (passport.manifest.rights.some((r) => r.disputed)) states.push('RIGHTS_DISPUTED');
  }

  if (passport.manifest.aiInvolvement !== 'unknown') states.push('AI_INVOLVEMENT_DECLARED');

  if (!signerTrusted || opts.assetBytes === undefined) states.push('VERIFICATION_INCOMPLETE');

  return {
    states,
    signatureValid,
    revoked,
    assetId: passport.manifest.assetId,
  };
}
