/**
 * Real local publishing adapter + published-content store.
 *
 * This adapter is NOT simulated: it performs real filesystem I/O and provides
 * real, crash-safe idempotency (the receipt is written to disk keyed by a hash
 * of the idempotency key; a replay reads it back). It is honestly a *local*
 * adapter — it publishes to a local store that the public verifier serves. It
 * does NOT post to any third-party platform; network adapters (LinkedIn,
 * YouTube, ...) require credentials and remain a later milestone. It implements
 * the same PublicationAdapter contract as the simulated adapter, so swapping
 * adapters changes nothing upstream.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildReceipt,
  sha256,
  type PublicationAdapter,
  type ExecuteParams,
  type ExecutionReceipt,
  type Passport,
} from '../../core/src/index.ts';

export interface PublishedRecord {
  digest: string;
  assetId: string;
  tenantId: string;
  platform: string;
  contentType: string;
  assetBase64: string;
  passport: Passport;
  receipt: ExecutionReceipt;
  publishedAt: string;
}

export interface PublishedSummary {
  digest: string;
  assetId: string;
  tenantId: string;
  platform: string;
  contentType: string;
  publishedAt: string;
}

/** Store of published (public) content, append-only JSONL, indexed by digest. */
export class PublishStore {
  private readonly file: string;
  private readonly byDigest = new Map<string, PublishedRecord>();

  constructor(file: string) {
    this.file = file;
    mkdirSync(join(file, '..'), { recursive: true });
    if (existsSync(file)) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (line.trim()) {
          const r = JSON.parse(line) as PublishedRecord;
          this.byDigest.set(r.digest, r);
        }
      }
    }
  }

  add(record: PublishedRecord): void {
    if (this.byDigest.has(record.digest)) return; // published content is immutable
    appendFileSync(this.file, JSON.stringify(record) + '\n');
    this.byDigest.set(record.digest, record);
  }

  getByDigest(digest: string): PublishedRecord | undefined {
    return this.byDigest.get(digest);
  }

  list(): PublishedSummary[] {
    return [...this.byDigest.values()].map((r) => ({
      digest: r.digest,
      assetId: r.assetId,
      tenantId: r.tenantId,
      platform: r.platform,
      contentType: r.contentType,
      publishedAt: r.publishedAt,
    }));
  }
}

export class LocalPublishAdapter implements PublicationAdapter {
  readonly name = 'local-fs/1';
  private readonly receiptDir: string;
  private readonly store: PublishStore;

  constructor(receiptDir: string, store: PublishStore) {
    this.receiptDir = receiptDir;
    this.store = store;
    mkdirSync(receiptDir, { recursive: true });
  }

  private receiptPath(idempotencyKey: string): string {
    return join(this.receiptDir, sha256(idempotencyKey).slice('sha256:'.length) + '.json');
  }

  execute(params: ExecuteParams): ExecutionReceipt {
    const path = this.receiptPath(params.idempotencyKey);
    if (existsSync(path)) {
      // Durable idempotency: return the previously committed receipt unchanged.
      return JSON.parse(readFileSync(path, 'utf8')) as ExecutionReceipt;
    }

    const receipt = buildReceipt(params, this.name, { scheme: 'local' });

    if (receipt.status === 'executed' && params.record) {
      this.store.add({
        digest: params.record.passport.manifest.digest,
        assetId: params.assetId,
        tenantId: params.record.passport.manifest.tenantId,
        platform: params.platform,
        contentType: params.record.contentType,
        assetBase64: params.record.assetBase64,
        passport: params.record.passport,
        receipt,
        publishedAt: params.now,
      });
    }

    // Commit the receipt last so idempotency reflects a fully applied side effect.
    writeFileSync(path, JSON.stringify(receipt));
    return receipt;
  }
}
