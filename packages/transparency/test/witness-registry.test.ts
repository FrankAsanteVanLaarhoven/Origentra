import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WitnessRegistry } from '../src/index.ts';
import { generateKeyPair } from '../../core/src/index.ts';

test('registry tracks witnesses, distinct operators, and builds a trust store', () => {
  const a = generateKeyPair();
  const b = generateKeyPair();
  const c = generateKeyPair();
  const reg = WitnessRegistry.fromRecords([
    { keyId: a.keyId, publicKeyPem: a.publicKeyPem, operator: 'acme' },
    { keyId: b.keyId, publicKeyPem: b.publicKeyPem, operator: 'globex' },
    { keyId: c.keyId, publicKeyPem: c.publicKeyPem, operator: 'acme' }, // same operator as a
  ]);

  assert.equal(reg.size, 3);
  assert.deepEqual(reg.operators().sort(), ['acme', 'globex']); // distinct operators
  assert.equal(reg.get(b.keyId)?.operator, 'globex');
  assert.equal(reg.trustStore().has(a.keyId), true);
  assert.equal(reg.trustStore().has(generateKeyPair().keyId), false);
});
