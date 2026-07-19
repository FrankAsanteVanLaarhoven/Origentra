import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Jwks, verifyIdToken, signIdToken, ssoToIdentity, type IdTokenClaims } from '../src/index.ts';
import { generateKeyPair, verifyIdentity, hasScope, TrustStore } from '../../core/src/index.ts';

const NOW = 1_760_000_000; // fixed epoch seconds
const ISSUER = 'https://idp.example.com';
const AUD = 'origentra';

function setup() {
  const idpKey = generateKeyPair();
  const jwks = new Jwks().add({ kid: 'idp-1', alg: 'EdDSA', publicKeyPem: idpKey.publicKeyPem });
  return { idpKey, jwks };
}
function claims(over: Partial<IdTokenClaims> = {}): IdTokenClaims {
  return { iss: ISSUER, sub: 'user-42', aud: AUD, exp: NOW + 3600, iat: NOW, roles: ['editor'], name: 'Ada', ...over };
}
const opts = (jwks: Jwks) => ({ jwks, issuer: ISSUER, audience: AUD, now: NOW });

test('a valid ID token verifies', () => {
  const { idpKey, jwks } = setup();
  const jwt = signIdToken(claims(), 'idp-1', idpKey.privateKeyPem);
  const r = verifyIdToken(jwt, opts(jwks));
  assert.equal(r.valid, true);
  assert.equal(r.claims?.sub, 'user-42');
});

test('expired / wrong-audience / wrong-issuer tokens are rejected', () => {
  const { idpKey, jwks } = setup();
  assert.equal(verifyIdToken(signIdToken(claims({ exp: NOW - 3600 }), 'idp-1', idpKey.privateKeyPem), opts(jwks)).reason, 'expired');
  assert.equal(verifyIdToken(signIdToken(claims({ aud: 'someone-else' }), 'idp-1', idpKey.privateKeyPem), opts(jwks)).reason, 'audience_mismatch');
  assert.equal(verifyIdToken(signIdToken(claims({ iss: 'https://evil.example' }), 'idp-1', idpKey.privateKeyPem), opts(jwks)).reason, 'issuer_mismatch');
});

test('a token signed by an unknown / wrong key is rejected', () => {
  const { jwks } = setup();
  const attacker = generateKeyPair();
  const forged = signIdToken(claims(), 'idp-1', attacker.privateKeyPem); // right kid, wrong key
  assert.equal(verifyIdToken(forged, opts(jwks)).reason, 'bad_signature');

  const unknownKid = signIdToken(claims(), 'idp-9', attacker.privateKeyPem);
  assert.equal(verifyIdToken(unknownKid, opts(jwks)).reason, 'unknown_kid');
});

test('verified claims map to a signed, scoped Origentra identity', () => {
  const { idpKey, jwks } = setup();
  const orgKey = generateKeyPair();
  const orgTrust = new TrustStore().add(orgKey.keyId, orgKey.publicKeyPem);
  const r = verifyIdToken(signIdToken(claims({ roles: ['editor'] }), 'idp-1', idpKey.privateKeyPem), opts(jwks));
  assert.ok(r.claims);

  const identity = ssoToIdentity(r.claims!, { tenantId: 't1', roleScopeMap: { editor: ['publish:propose', 'asset:register'] }, issuedAt: '2026-07-19T00:00:00.000Z' }, orgKey);
  assert.equal(verifyIdentity(identity, { now: '2026-07-19T00:00:00.000Z', trustStore: orgTrust }).valid, true);
  assert.equal(hasScope(identity.claim, 'publish:propose'), true);
  assert.equal(hasScope(identity.claim, 'publish:approve'), false, 'no scope beyond the role map');
});
