import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createWitnessService } from '../server.ts';
import {
  TransparencyLog,
  HttpWitnessTransport,
  distributeCheckpoint,
  auditSplitView,
  verifyCosignature,
} from '../../../packages/transparency/src/index.ts';
import { generateKeyPair, TrustStore, type KeyPair } from '../../../packages/core/src/index.ts';

async function start(witnessKey: KeyPair, logTrust: TrustStore): Promise<{ base: string; server: Server }> {
  const server = createWitnessService(witnessKey, logTrust);
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as AddressInfo).port;
  return { base: `http://127.0.0.1:${port}`, server };
}
const close = (s: Server) => new Promise<void>((r) => s.close(() => r()));

function fill(log: TransparencyLog, n: number) {
  for (let i = 0; i < n; i++) log.append(`e-${i}`);
}

test('a witness service cosigns over HTTP and reports its latest view', async () => {
  const logKey = generateKeyPair();
  const logTrust = new TrustStore().add(logKey.keyId, logKey.publicKeyPem);
  const witnessKey = generateKeyPair();
  const { base, server } = await start(witnessKey, logTrust);
  try {
    const t = await HttpWitnessTransport.connect(base);
    assert.equal(t.keyId, witnessKey.keyId);

    const log = new TransparencyLog();
    fill(log, 5);
    const cp = log.checkpoint(logKey);
    const r = await distributeCheckpoint(cp, (m) => log.consistencyProof(m), [t]);
    assert.equal(r.accepted, 1);
    assert.equal(verifyCosignature(cp, r.witnessed.cosignatures[0]!), true);

    const latest = await t.latest(cp.logId);
    assert.equal(latest?.size, 5);
  } finally {
    await close(server);
  }
});

test('a split view across two witness services is detected by the auditor', async () => {
  const logKey = generateKeyPair();
  const logTrust = new TrustStore().add(logKey.keyId, logKey.publicKeyPem);
  const a = await start(generateKeyPair(), logTrust);
  const b = await start(generateKeyPair(), logTrust);
  try {
    const tA = await HttpWitnessTransport.connect(a.base);
    const tB = await HttpWitnessTransport.connect(b.base);

    // The log shows witness A the honest head and witness B a same-size fork.
    const honest = new TransparencyLog();
    fill(honest, 6);
    await distributeCheckpoint(honest.checkpoint(logKey), (m) => honest.consistencyProof(m), [tA]);

    const fork = new TransparencyLog();
    for (let i = 0; i < 6; i++) fork.append(`F-${i}`);
    await distributeCheckpoint(fork.checkpoint(logKey), (m) => fork.consistencyProof(m), [tB]);

    const audit = await auditSplitView('origentra-log/1', [tA, tB]);
    assert.equal(audit.forked, true);
  } finally {
    await close(a.server);
    await close(b.server);
  }
});
