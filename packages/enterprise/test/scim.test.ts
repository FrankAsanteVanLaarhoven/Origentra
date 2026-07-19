import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScimProvisioner } from '../src/index.ts';
import { generateKeyPair, verifyIdentity, hasScope, TrustStore } from '../../core/src/index.ts';

let clock = 0;
const now = () => `2026-07-19T10:00:0${clock++ % 10}.000Z`;

function setup() {
  const issuerKey = generateKeyPair();
  const trust = new TrustStore().add(issuerKey.keyId, issuerKey.publicKeyPem);
  const scim = new ScimProvisioner(issuerKey, {
    tenantId: 't1',
    roleScopeMap: { editor: ['publish:propose'], approver: ['publish:approve'] },
    now,
  });
  return { scim, trust };
}

test('creating a SCIM user issues a valid, scoped Origentra identity', () => {
  const { scim, trust } = setup();
  const user = scim.create({ userName: 'ada@example.com', roles: ['editor'] });
  assert.equal(user.active, true);
  const identity = scim.identityFor(user.id)!;
  assert.equal(verifyIdentity(identity, { now: '2026-07-19T11:00:00.000Z', trustStore: trust }).valid, true);
  assert.equal(hasScope(identity.claim, 'publish:propose'), true);
});

test('deactivating a user deprovisions (revokes) the identity', () => {
  const { scim, trust } = setup();
  const user = scim.create({ userName: 'bob@example.com', roles: ['approver'] });
  scim.setActive(user.id, false);
  const identity = scim.identityFor(user.id)!;
  const v = verifyIdentity(identity, { now: '2026-07-19T12:00:00.000Z', trustStore: trust });
  assert.equal(v.valid, false);
  assert.equal(v.revoked, true);
});

test('role changes re-issue the identity with new scopes', () => {
  const { scim } = setup();
  const user = scim.create({ userName: 'carol@example.com', roles: ['editor'] });
  scim.replaceRoles(user.id, ['approver']);
  const identity = scim.identityFor(user.id)!;
  assert.equal(hasScope(identity.claim, 'publish:approve'), true);
  assert.equal(hasScope(identity.claim, 'publish:propose'), false);
});

test('delete deprovisions and removes the user record', () => {
  const { scim, trust } = setup();
  const user = scim.create({ userName: 'dan@example.com', roles: ['editor'] });
  scim.delete(user.id);
  assert.equal(scim.get(user.id), undefined);
  const identity = scim.identityFor(user.id)!;
  assert.equal(verifyIdentity(identity, { now: '2026-07-19T13:00:00.000Z', trustStore: trust }).revoked, true);
});

test('duplicate userName is a conflict', () => {
  const { scim } = setup();
  scim.create({ userName: 'eve@example.com' });
  assert.throws(() => scim.create({ userName: 'eve@example.com' }), /conflict/);
});
