/**
 * SSO via OIDC — ID-token (JWT) verification.
 *
 * Verifies a signed OIDC ID token against a JWKS key set and the expected issuer
 * and audience, with expiry/not-before checks. Supports EdDSA (Ed25519) and RS256
 * — the two signature schemes node's crypto covers without dependencies. A
 * verified token maps to an Origentra identity claim, with scopes derived from the
 * token's roles via an explicit role→scope map (least privilege).
 *
 * NOTE: this is OIDC/JWT SSO. XML-based SAML (XML-DSig) is a separate, heavier
 * scheme and is NOT implemented — OIDC is the modern enterprise path.
 */

import { sign as edSign, verify as edVerify, createPrivateKey } from 'node:crypto';
import { issueIdentity, type SignedIdentityClaim, type KeyPair } from '../../core/src/index.ts';

const b64url = (b: Buffer) => b.toString('base64url');
const unb64url = (s: string) => Buffer.from(s, 'base64url');

export type JwtAlg = 'EdDSA' | 'RS256';

export interface JwkEntry {
  kid: string;
  alg: JwtAlg;
  publicKeyPem: string;
}

export class Jwks {
  #keys = new Map<string, JwkEntry>();
  add(entry: JwkEntry): this {
    this.#keys.set(entry.kid, entry);
    return this;
  }
  get(kid: string): JwkEntry | undefined {
    return this.#keys.get(kid);
  }
}

export interface IdTokenClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat?: number;
  nbf?: number;
  email?: string;
  name?: string;
  roles?: string[];
  [k: string]: unknown;
}

export interface VerifyIdTokenOptions {
  jwks: Jwks;
  issuer: string;
  audience: string;
  /** Seconds since epoch. */
  now: number;
  /** Allowed clock skew in seconds. Default 60. */
  clockSkew?: number;
}

export interface VerifyResult {
  valid: boolean;
  claims?: IdTokenClaims;
  reason?: string;
}

function verifySignature(alg: JwtAlg, signingInput: Buffer, publicKeyPem: string, sig: Buffer): boolean {
  try {
    if (alg === 'EdDSA') return edVerify(null, signingInput, publicKeyPem, sig);
    if (alg === 'RS256') return edVerify('sha256', signingInput, publicKeyPem, sig);
    return false;
  } catch {
    return false;
  }
}

export function verifyIdToken(jwt: string, opts: VerifyIdTokenOptions): VerifyResult {
  const parts = jwt.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'malformed' };
  const [h, p, s] = parts;
  let header: { alg?: JwtAlg; kid?: string; typ?: string };
  let claims: IdTokenClaims;
  try {
    header = JSON.parse(unb64url(h!).toString('utf8'));
    claims = JSON.parse(unb64url(p!).toString('utf8'));
  } catch {
    return { valid: false, reason: 'bad_json' };
  }

  if (!header.alg || (header.alg !== 'EdDSA' && header.alg !== 'RS256')) return { valid: false, reason: 'unsupported_alg' };
  if (!header.kid) return { valid: false, reason: 'missing_kid' };
  const key = opts.jwks.get(header.kid);
  if (!key) return { valid: false, reason: 'unknown_kid' };
  if (key.alg !== header.alg) return { valid: false, reason: 'alg_mismatch' };

  const signingInput = Buffer.from(`${h}.${p}`, 'utf8');
  if (!verifySignature(header.alg, signingInput, key.publicKeyPem, unb64url(s!))) {
    return { valid: false, reason: 'bad_signature' };
  }

  const skew = opts.clockSkew ?? 60;
  if (claims.iss !== opts.issuer) return { valid: false, reason: 'issuer_mismatch' };
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(opts.audience)) return { valid: false, reason: 'audience_mismatch' };
  if (typeof claims.exp !== 'number' || claims.exp + skew < opts.now) return { valid: false, reason: 'expired' };
  if (typeof claims.nbf === 'number' && claims.nbf - skew > opts.now) return { valid: false, reason: 'not_yet_valid' };

  return { valid: true, claims };
}

/** Map verified SSO claims to a signed Origentra identity, least-privilege scopes. */
export function ssoToIdentity(
  claims: IdTokenClaims,
  opts: { tenantId: string; roleScopeMap: Record<string, string[]>; issuedAt: string; expiresAt?: string },
  issuerKey: KeyPair,
): SignedIdentityClaim {
  const scopes = new Set<string>();
  for (const role of claims.roles ?? []) for (const scope of opts.roleScopeMap[role] ?? []) scopes.add(scope);
  return issueIdentity(
    {
      identityId: `sso:${claims.sub}`,
      tenantId: opts.tenantId,
      subjectType: 'person',
      displayName: claims.name ?? claims.email ?? claims.sub,
      scopes: [...scopes],
      issuedAt: opts.issuedAt,
      ...(opts.expiresAt ? { expiresAt: opts.expiresAt } : {}),
    },
    issuerKey,
  );
}

/** Sign an OIDC ID token (for issuers and tests). EdDSA/Ed25519 only. */
export function signIdToken(claims: IdTokenClaims, kid: string, privateKeyPem: string): string {
  const header = { alg: 'EdDSA' as const, kid, typ: 'JWT' };
  const h = b64url(Buffer.from(JSON.stringify(header)));
  const p = b64url(Buffer.from(JSON.stringify(claims)));
  const sig = edSign(null, Buffer.from(`${h}.${p}`, 'utf8'), createPrivateKey(privateKeyPem));
  return `${h}.${p}.${b64url(sig)}`;
}
