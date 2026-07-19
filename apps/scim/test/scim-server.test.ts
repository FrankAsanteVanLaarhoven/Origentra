import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createScimServer } from '../server.ts';
import { ScimProvisioner } from '../../../packages/enterprise/src/index.ts';
import { generateKeyPair, verifyIdentity, TrustStore } from '../../../packages/core/src/index.ts';

let clock = 0;
const now = () => `2026-07-19T10:00:0${clock++ % 10}.000Z`;
const TOKEN = 'prov-secret';

async function start() {
  const issuerKey = generateKeyPair();
  const trust = new TrustStore().add(issuerKey.keyId, issuerKey.publicKeyPem);
  const provisioner = new ScimProvisioner(issuerKey, { tenantId: 't1', roleScopeMap: { editor: ['publish:propose'] }, now });
  const server = createScimServer(provisioner, TOKEN);
  await new Promise<void>((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, server, provisioner, trust };
}
const close = (s: Server) => new Promise<void>((r) => s.close(() => r()));
const auth = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/scim+json' };

test('provisioning lifecycle over HTTP: create issues an identity, deactivate revokes it', async () => {
  const { base, server, provisioner, trust } = await start();
  try {
    // unauthenticated is rejected
    const noAuth = await fetch(base + '/scim/v2/Users', { method: 'POST', body: '{}' });
    assert.equal(noAuth.status, 401);

    // create
    const created = await fetch(base + '/scim/v2/Users', { method: 'POST', headers: auth, body: JSON.stringify({ userName: 'ada@example.com', roles: ['editor'] }) });
    assert.equal(created.status, 201);
    const user = await created.json();
    assert.equal(user.active, true);

    const identity = provisioner.identityFor(user.id)!;
    assert.equal(verifyIdentity(identity, { now: '2026-07-19T11:00:00.000Z', trustStore: trust }).valid, true);

    // deactivate via SCIM PatchOp
    const patched = await fetch(base + '/scim/v2/Users/' + user.id, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'], Operations: [{ op: 'replace', path: 'active', value: false }] }),
    });
    assert.equal(patched.status, 200);
    assert.equal(verifyIdentity(provisioner.identityFor(user.id)!, { now: '2026-07-19T12:00:00.000Z', trustStore: trust }).revoked, true);

    // list shows the user
    const list = await (await fetch(base + '/scim/v2/Users', { headers: auth })).json();
    assert.equal(list.totalResults, 1);
  } finally {
    await close(server);
  }
});
