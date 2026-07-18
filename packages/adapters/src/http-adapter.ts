/**
 * Resilient HTTP publication adapter.
 *
 * Implements the core PublicationAdapter contract over real HTTP with the
 * behaviours a hostile/flaky platform API demands:
 *   - OAuth2 bearer auth via a TokenProvider
 *   - an Idempotency-Key header so a retried request is de-duplicated by the
 *     platform (the whole point: a timeout can be retried safely)
 *   - exponential backoff on 5xx and 429 (honouring Retry-After)
 *   - per-request timeout via AbortController
 *   - categorised failures (AdapterError) instead of a fake "executed" receipt
 *
 * It signs an executed receipt ONLY on a confirmed 2xx from the platform, using
 * the platform's returned id as the externalRef. If policy did not authorise the
 * action, no network call is made and a blocked receipt is returned.
 *
 * HONESTY: this is transport + resilience, exercised end-to-end against a mock
 * platform in tests. It does not, by itself, publish to any real third-party
 * service — that requires the operator's credentials and a live endpoint.
 */

import {
  buildReceipt,
  type PublicationAdapter,
  type ExecuteParams,
  type ExecutionReceipt,
} from '../../core/src/index.ts';
import { AdapterError } from './errors.ts';
import type { TokenProvider } from './token.ts';

export interface HttpPublishAdapterConfig {
  /** Adapter name recorded in receipts. */
  name?: string;
  /** POST endpoint that creates a publication. */
  endpoint: string;
  tokenProvider: TokenProvider;
  /** externalRef scheme, e.g. 'linkedin'. Default 'http'. */
  scheme?: string;
  maxRetries?: number; // default 3
  timeoutMs?: number; // default 5000
  baseDelayMs?: number; // default 250
  maxDelayMs?: number; // default 5000
  /** Map execute params -> platform request payload. */
  buildBody?: (params: ExecuteParams) => unknown;
  /** Extract the platform's post id from a success response. */
  parseRef?: (json: unknown) => string;
  /** Injected for tests. */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class HttpPublishAdapter implements PublicationAdapter {
  readonly name: string;
  #cfg: Required<Omit<HttpPublishAdapterConfig, 'name' | 'tokenProvider'>> & {
    tokenProvider: TokenProvider;
  };

  constructor(cfg: HttpPublishAdapterConfig) {
    this.name = cfg.name ?? 'http/1';
    this.#cfg = {
      endpoint: cfg.endpoint,
      tokenProvider: cfg.tokenProvider,
      scheme: cfg.scheme ?? 'http',
      maxRetries: cfg.maxRetries ?? 3,
      timeoutMs: cfg.timeoutMs ?? 5000,
      baseDelayMs: cfg.baseDelayMs ?? 250,
      maxDelayMs: cfg.maxDelayMs ?? 5000,
      buildBody: cfg.buildBody ?? defaultBuildBody,
      parseRef: cfg.parseRef ?? ((j) => String((j as { id?: unknown })?.id ?? '')),
      fetchImpl: cfg.fetchImpl ?? fetch,
      sleep: cfg.sleep ?? defaultSleep,
    };
  }

  async execute(params: ExecuteParams): Promise<ExecutionReceipt> {
    if (!params.authorization.authorized) {
      return buildReceipt(params, this.name, { status: 'blocked' });
    }
    const externalRef = await this.#publish(params);
    return buildReceipt(params, this.name, { externalRef, status: 'executed' });
  }

  async #publish(params: ExecuteParams): Promise<string> {
    const c = this.#cfg;
    const token = await c.tokenProvider.getToken(); // may throw AdapterError('auth')

    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.#fetchWithTimeout(token, params);
      } catch (e) {
        if (attempt < c.maxRetries) {
          await c.sleep(this.#backoffDelay(attempt));
          continue;
        }
        throw new AdapterError('timeout', `request failed after ${attempt + 1} attempts: ${msg(e)}`);
      }

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        return `${c.scheme}://${params.platform}/${c.parseRef(json)}`;
      }
      if (res.status === 401 || res.status === 403) throw new AdapterError('auth', 'unauthorised', res.status);
      if (res.status === 400 || res.status === 422) throw new AdapterError('bad_request', `rejected ${res.status}`, res.status);
      if (res.status === 429) {
        if (attempt < c.maxRetries) {
          await c.sleep(this.#retryAfterDelay(res, attempt));
          continue;
        }
        throw new AdapterError('rate_limited', 'rate limited', 429);
      }
      if (res.status >= 500) {
        if (attempt < c.maxRetries) {
          await c.sleep(this.#backoffDelay(attempt));
          continue;
        }
        throw new AdapterError('outage', `platform outage ${res.status}`, res.status);
      }
      throw new AdapterError('bad_request', `unexpected status ${res.status}`, res.status);
    }
  }

  async #fetchWithTimeout(token: string, params: ExecuteParams): Promise<Response> {
    const c = this.#cfg;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), c.timeoutMs);
    try {
      return await c.fetchImpl(c.endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'idempotency-key': params.idempotencyKey,
        },
        body: JSON.stringify(c.buildBody(params)),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  #backoffDelay(attempt: number): number {
    return Math.min(this.#cfg.maxDelayMs, this.#cfg.baseDelayMs * 2 ** attempt);
  }

  #retryAfterDelay(res: Response, attempt: number): number {
    const ra = res.headers.get('retry-after');
    if (ra !== null && /^\d+$/.test(ra)) return Math.min(this.#cfg.maxDelayMs, Number(ra) * 1000);
    return this.#backoffDelay(attempt);
  }
}

function defaultBuildBody(params: ExecuteParams): unknown {
  return {
    assetId: params.assetId,
    platform: params.platform,
    contentType: params.record?.contentType,
    contentBase64: params.record?.assetBase64,
    passportDigest: params.record?.passport.manifest.digest,
  };
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
