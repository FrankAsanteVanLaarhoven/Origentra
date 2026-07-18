/**
 * Origentra core — shared type definitions.
 *
 * These types are the reference schema for the Content Passport, identity
 * claims, rights records, policy decisions, execution receipts and the
 * tamper-evident audit log. They are intentionally transport-agnostic:
 * everything here is plain JSON so it can be canonicalised, signed and
 * verified by any conforming implementation.
 */

/** A content digest, formatted as `sha256:<hex>` (a self-describing string). */
export type Digest = string;

/** ISO-8601 timestamp string, e.g. `2026-07-18T10:00:00.000Z`. */
export type Timestamp = string;

/**
 * Declared involvement of AI in an asset's creation. Origentra records a
 * machine-readable declaration; it does NOT attempt to detect AI involvement
 * that a creator has not declared (see docs/LIMITATIONS.md).
 */
export type AiInvolvement =
  | 'none'
  | 'assisted'
  | 'generated'
  | 'synthetic_voice'
  | 'synthetic_likeness'
  | 'fully_synthetic'
  | 'unknown';

export const AI_INVOLVEMENT_VALUES: readonly AiInvolvement[] = [
  'none',
  'assisted',
  'generated',
  'synthetic_voice',
  'synthetic_likeness',
  'fully_synthetic',
  'unknown',
] as const;

/** The kind of right or consent an assertion covers. */
export type RightKind =
  | 'ownership'
  | 'joint_ownership'
  | 'work_for_hire'
  | 'exclusive_licence'
  | 'non_exclusive_licence'
  | 'music_licence'
  | 'voice_consent'
  | 'likeness_consent'
  | 'model_release'
  | 'minor_guardian_consent'
  | 'ai_training_permission'
  | 'synthetic_voice_permission'
  | 'synthetic_likeness_permission';

/**
 * A single rights/consent assertion.
 *
 * IMPORTANT: A rights record is an *assertion supported by evidence*, not a
 * legal determination. Origentra manages assertions, evidence and disputes;
 * it does not conclusively determine legal ownership (see docs/CLAIMS.md).
 */
export interface RightsRecord {
  kind: RightKind;
  /** Free-form identifier of who holds/grants the right. */
  holder: string;
  /** Optional reference to supporting evidence (contract id, URL hash, etc.). */
  evidenceRef?: string;
  /** Platforms this right is restricted to; empty/absent means unrestricted. */
  platforms?: string[];
  /** ISO country codes this right is restricted to; absent means unrestricted. */
  territories?: string[];
  /** Whether advertising use is permitted under this right. */
  advertisingPermitted?: boolean;
  /** Whether derivative use is permitted under this right. */
  derivativePermitted?: boolean;
  /** Expiry timestamp; absent means no expiry. */
  expiresAt?: Timestamp;
  /** Set when the granting party has withdrawn consent. */
  revokedAt?: Timestamp;
  /** Set when ownership/validity of this right is contested. */
  disputed?: boolean;
}

/** A content fingerprint used to recover provenance after transformation. */
export interface Fingerprint {
  /** Algorithm identifier, e.g. `cdc-gear-v1`. */
  algo: string;
  /** Opaque, comparable representation (see fingerprint.ts). */
  value: string;
}

/** A recorded transformation applied to an asset (compression, crop, ...). */
export interface Transformation {
  kind: string;
  at: Timestamp;
  note?: string;
}

/** The signed, canonical description of a protected asset. */
export interface PassportManifest {
  /** Schema version of the manifest. */
  schema: 'origentra.passport/1';
  /** Stable, unique asset identifier within the issuing tenant. */
  assetId: string;
  /** Owning tenant (organisation) identifier. */
  tenantId: string;
  /** Exact content digest of the asset bytes at registration. */
  digest: Digest;
  /** MIME type of the asset. */
  contentType: string;
  /** Registration time. */
  createdAt: Timestamp;
  /** Identity id of the human/organisation creator. */
  creatorIdentityId: string;
  /** Declared AI involvement. */
  aiInvolvement: AiInvolvement;
  /** Rights and consent assertions attached at registration. */
  rights: RightsRecord[];
  /** Perceptual/fuzzy fingerprints for survivability across transformations. */
  fingerprints: Fingerprint[];
  /** Transformation lineage, oldest first. */
  transformations: Transformation[];
}

/** The public part of a signer. */
export interface SignerRef {
  keyId: string;
  publicKeyPem: string;
}

/** A Content Passport: a manifest plus a detached signature over it. */
export interface Passport {
  manifest: PassportManifest;
  signer: SignerRef;
  /** Base64 Ed25519 signature over the canonical manifest bytes. */
  signature: string;
  signedAt: Timestamp;
  /** Revocation marker; a revoked passport verifies as CREDENTIAL_REVOKED. */
  revocation?: { revokedAt: Timestamp; reason: string };
}

/** A signed identity claim binding a subject to a tenant with scopes. */
export interface IdentityClaim {
  schema: 'origentra.identity/1';
  identityId: string;
  tenantId: string;
  /** Subject kind: a person, organisation, device or AI agent. */
  subjectType: 'person' | 'organisation' | 'brand' | 'device' | 'agent';
  displayName: string;
  /** Granted scopes, e.g. `asset:register`, `publish:propose`, `publish:approve`. */
  scopes: string[];
  issuedAt: Timestamp;
  expiresAt?: Timestamp;
  revocation?: { revokedAt: Timestamp; reason: string };
}

export interface SignedIdentityClaim {
  claim: IdentityClaim;
  signer: SignerRef;
  signature: string;
}

/**
 * Discrete verification states. Origentra deliberately does NOT emit a single
 * universal "trust score"; a verifier receives an evidence-based set of states
 * and decides for itself. See docs/CLAIMS.md.
 */
export type VerificationState =
  | 'SIGNATURE_VALID'
  | 'SIGNATURE_INVALID'
  | 'SIGNER_TRUSTED'
  | 'SIGNER_UNKNOWN'
  | 'PROVENANCE_RECOVERED'
  | 'ASSET_MODIFIED'
  | 'RIGHTS_RECORDED'
  | 'RIGHTS_DISPUTED'
  | 'AI_INVOLVEMENT_DECLARED'
  | 'CREDENTIAL_REVOKED'
  | 'VERIFICATION_INCOMPLETE';

export interface VerificationResult {
  states: VerificationState[];
  /** True only when the signature is valid and the credential is not revoked. */
  signatureValid: boolean;
  revoked: boolean;
  /** The asset id if a manifest was present, for convenience. */
  assetId?: string;
}
