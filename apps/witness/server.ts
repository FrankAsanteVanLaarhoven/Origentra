/**
 * Origentra Witness — an independent witness service (Node.js stdlib only).
 *
 * Wraps a single Witness that co-signs checkpoints only for logs whose signing
 * key it trusts, and only when a checkpoint is an append-only successor of what
 * it last saw. A log operator collects cosignatures via POST /cosign; an auditor
 * compares witness views via GET /latest to detect a split view.
 *
 * Endpoints:
 *   GET  /health              liveness
 *   GET  /witness             this witness's identity { keyId, publicKeyPem }
 *   GET  /latest?logId=       the witness's last-seen view of a log, or null
 *   POST /cosign              { checkpoint, consistencyProof? } -> CosignResult
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import {
  Witness,
  type SignedCheckpoint,
  type ConsistencyProofResult,
} from '../../packages/transparency/src/index.ts';
import { type KeyPair, type TrustStore } from '../../packages/core/src/index.ts';

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const c of req) {
    total += (c as Buffer).length;
    if (total > 8 * 1024 * 1024) throw new Error('payload too large');
    chunks.push(c as Buffer);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

export function createWitnessService(witnessKey: KeyPair, logTrust: TrustStore): Server {
  const witness = new Witness(witnessKey, logTrust);

  return createServer((req, res) => {
    void handle(req, res).catch((err) => send(res, 400, { error: String(err?.message ?? err) }));
  });

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;

    if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true });
    if (req.method === 'GET' && path === '/witness') {
      return send(res, 200, { keyId: witnessKey.keyId, publicKeyPem: witnessKey.publicKeyPem });
    }
    if (req.method === 'GET' && path === '/latest') {
      const logId = url.searchParams.get('logId') ?? '';
      return send(res, 200, { view: witness.lastSeen(logId) ?? null });
    }
    if (req.method === 'POST' && path === '/cosign') {
      const body = (await readJson(req)) as {
        checkpoint?: SignedCheckpoint;
        consistencyProof?: ConsistencyProofResult;
      };
      if (!body.checkpoint) return send(res, 400, { error: 'checkpoint required' });
      return send(res, 200, witness.cosign(body.checkpoint, body.consistencyProof));
    }
    return send(res, 404, { error: 'not_found' });
  }
}

// Run directly: node apps/witness/server.ts (a fresh witness key each start;
// for a persistent witness, supply a stable key via your own bootstrap).
if (import.meta.url === `file://${process.argv[1]}`) {
  const { generateKeyPair, TrustStore } = await import('../../packages/core/src/index.ts');
  const key = generateKeyPair();
  const port = Number(process.env.PORT ?? 8790);
  createWitnessService(key, new TrustStore()).listen(port, () => {
    console.log(`Origentra Witness ${key.keyId} on http://localhost:${port} (trusts no logs until configured)`);
  });
}
