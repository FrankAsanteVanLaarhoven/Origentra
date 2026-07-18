/** Shared test fixtures. Deterministic timestamps; fresh keys per call. */
import { generateKeyPair, issueIdentity, TrustStore } from '../src/index.ts';
import type { KeyPair } from '../src/keys.ts';
import type { SignedIdentityClaim } from '../src/index.ts';

export const T0 = '2026-07-18T10:00:00.000Z';
export const T1 = '2026-07-18T10:05:00.000Z';

export interface World {
  issuerKey: KeyPair;
  trust: TrustStore;
}

/** An issuer whose key is in the trust store (the tenant's identity authority). */
export function makeWorld(): World {
  const issuerKey = generateKeyPair();
  const trust = new TrustStore().add(issuerKey.keyId, issuerKey.publicKeyPem);
  return { issuerKey, trust };
}

export function makeIdentity(
  world: World,
  opts: {
    identityId: string;
    tenantId: string;
    subjectType?: SignedIdentityClaim['claim']['subjectType'];
    scopes: string[];
  },
): SignedIdentityClaim {
  return issueIdentity(
    {
      identityId: opts.identityId,
      tenantId: opts.tenantId,
      subjectType: opts.subjectType ?? 'person',
      displayName: opts.identityId,
      scopes: opts.scopes,
      issuedAt: T0,
    },
    world.issuerKey,
  );
}
