/**
 * External anchoring of checkpoint roots.
 *
 * Anchoring publishes a checkpoint root to an append-only, independently
 * retained record so that the log's head at a point in time cannot later be
 * disowned. `FileAnchor` is a REAL local append-only anchor. A blockchain or
 * third-party timestamp anchor is a matching implementation of the same `Anchor`
 * interface — that is deliberately NOT implemented here (it would need an
 * external service), and nothing claims a root has been anchored on-chain.
 *
 * Per the project's data policy, only the signed checkpoint root is anchored —
 * never raw content, identities, licences or consent records.
 */

import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  canonicalBytes,
  sign,
  verify as verifySig,
  signerRef,
  type KeyPair,
  type SignerRef,
  type TrustStore,
} from '../../core/src/index.ts';
import type { Checkpoint } from './log.ts';

export interface AnchorRecord {
  logId: string;
  size: number;
  rootHash: string;
  anchoredAt: string;
}
export interface SignedAnchor extends AnchorRecord {
  signer: SignerRef;
  signature: string;
}

export function signAnchor(cp: Checkpoint, anchoredAt: string, key: KeyPair): SignedAnchor {
  const body: AnchorRecord = { logId: cp.logId, size: cp.size, rootHash: cp.rootHash, anchoredAt };
  return { ...body, signer: signerRef(key), signature: sign(key.privateKeyPem, canonicalBytes(body)) };
}

export function verifyAnchor(a: SignedAnchor, trust: TrustStore): boolean {
  const { signer, signature, ...body } = a;
  return trust.has(signer.keyId) && verifySig(signer.publicKeyPem, canonicalBytes(body), signature);
}

export interface Anchor {
  anchor(cp: Checkpoint, anchoredAt: string, key: KeyPair): SignedAnchor;
  list(): SignedAnchor[];
}

/** A real local append-only anchor (JSONL on disk). */
export class FileAnchor implements Anchor {
  #file: string;
  #records: SignedAnchor[] = [];

  constructor(file: string) {
    this.#file = file;
    if (existsSync(file)) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (line.trim()) this.#records.push(JSON.parse(line) as SignedAnchor);
      }
    } else {
      mkdirSync(dirname(file), { recursive: true });
    }
  }

  anchor(cp: Checkpoint, anchoredAt: string, key: KeyPair): SignedAnchor {
    const record = signAnchor(cp, anchoredAt, key);
    appendFileSync(this.#file, JSON.stringify(record) + '\n');
    this.#records.push(record);
    return record;
  }

  list(): SignedAnchor[] {
    return [...this.#records];
  }

  find(logId: string, size: number): SignedAnchor | undefined {
    return this.#records.find((r) => r.logId === logId && r.size === size);
  }
}
