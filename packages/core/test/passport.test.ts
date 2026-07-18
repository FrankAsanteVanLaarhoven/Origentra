import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateKeyPair,
  createPassport,
  verifyPassport,
  revokePassport,
  TrustStore,
  PassportStore,
} from '../src/index.ts';
import { T0 } from './helpers.ts';

const ASSET = 'This is a protected article about Origentra. '.repeat(30);

function fixture() {
  const signer = generateKeyPair();
  const trust = new TrustStore().add(signer.keyId, signer.publicKeyPem);
  const passport = createPassport(ASSET, {
    assetId: 'asset-1',
    tenantId: 'tenant-1',
    contentType: 'text/plain',
    createdAt: T0,
    creatorIdentityId: 'id-creator',
    aiInvolvement: 'assisted',
    rights: [{ kind: 'ownership', holder: 'id-creator' }],
  }, signer);
  return { signer, trust, passport };
}

test('valid, trusted passport with matching bytes recovers provenance', () => {
  const { trust, passport } = fixture();
  const r = verifyPassport(passport, { trustStore: trust, assetBytes: ASSET });
  assert.equal(r.signatureValid, true);
  assert.ok(r.states.includes('SIGNATURE_VALID'));
  assert.ok(r.states.includes('SIGNER_TRUSTED'));
  assert.ok(r.states.includes('PROVENANCE_RECOVERED'));
  assert.ok(r.states.includes('RIGHTS_RECORDED'));
  assert.ok(r.states.includes('AI_INVOLVEMENT_DECLARED'));
  assert.ok(!r.states.includes('VERIFICATION_INCOMPLETE'));
});

test('unknown signer yields SIGNER_UNKNOWN and VERIFICATION_INCOMPLETE', () => {
  const { passport } = fixture();
  const r = verifyPassport(passport, { trustStore: new TrustStore(), assetBytes: ASSET });
  assert.ok(r.states.includes('SIGNER_UNKNOWN'));
  assert.ok(r.states.includes('VERIFICATION_INCOMPLETE'));
});

test('tampered manifest fails signature', () => {
  const { trust, passport } = fixture();
  const tampered = structuredClone(passport);
  tampered.manifest.rights = [{ kind: 'ownership', holder: 'attacker' }];
  const r = verifyPassport(tampered, { trustStore: trust, assetBytes: ASSET });
  assert.equal(r.signatureValid, false);
  assert.ok(r.states.includes('SIGNATURE_INVALID'));
});

test('modified asset bytes report ASSET_MODIFIED, not PROVENANCE_RECOVERED', () => {
  const { trust, passport } = fixture();
  const different = 'A totally unrelated document about sailing boats. '.repeat(30);
  const r = verifyPassport(passport, { trustStore: trust, assetBytes: different });
  assert.ok(r.states.includes('ASSET_MODIFIED'));
  assert.ok(!r.states.includes('PROVENANCE_RECOVERED'));
});

test('revoked passport reports CREDENTIAL_REVOKED', () => {
  const { trust, passport } = fixture();
  const revoked = revokePassport(passport, T0, 'compromise');
  const r = verifyPassport(revoked, { trustStore: trust, assetBytes: ASSET });
  assert.equal(r.revoked, true);
  assert.ok(r.states.includes('CREDENTIAL_REVOKED'));
});

test('store recovers passport exactly by digest', () => {
  const { passport } = fixture();
  const store = new PassportStore().put(passport);
  const rec = store.recover(ASSET);
  assert.ok(rec);
  assert.equal(rec.exact, true);
  assert.equal(rec.passport.manifest.assetId, 'asset-1');
});

test('store recovers passport fuzzily after a localized transformation', () => {
  const { passport } = fixture();
  const store = new PassportStore().put(passport);
  const transformed = ASSET.replace('protected article', 'PROTECTED article') + ' minor suffix';
  const rec = store.recover(transformed, 0.6);
  assert.ok(rec, 'expected fuzzy recovery of a transformed copy');
  assert.equal(rec.exact, false);
  assert.ok(rec.score >= 0.6);
});
