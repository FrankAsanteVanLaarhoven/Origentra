/**
 * OAuth2 token providers.
 *
 * A TokenProvider yields a bearer token for the platform. Credentials never
 * appear in code or logs; they are supplied at construction by the operator.
 * The OAuth2 client-credentials provider fetches and caches a token, refreshing
 * proactively before expiry.
 */

import { AdapterError } from './errors.ts';

export interface TokenProvider {
  getToken(): Promise<string>;
}

/** A fixed token (e.g. a long-lived page token supplied by the operator). */
export class StaticTokenProvider implements TokenProvider {
  #token: string;
  constructor(token: string) {
    this.#token = token;
  }
  async getToken(): Promise<string> {
    return this.#token;
  }
}

export interface OAuth2Config {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}

export interface OAuth2Options {
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injected clock in ms; defaults to Date.now. */
  now?: () => number;
  /** Refresh this many ms before the token actually expires. */
  refreshSkewMs?: number;
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
}

/** OAuth2 client-credentials grant with proactive caching/refresh. */
export class OAuth2ClientCredentialsProvider implements TokenProvider {
  #cfg: OAuth2Config;
  #fetch: typeof fetch;
  #now: () => number;
  #skew: number;
  #cached: { token: string; expiresAt: number } | undefined;

  constructor(cfg: OAuth2Config, opts: OAuth2Options = {}) {
    this.#cfg = cfg;
    this.#fetch = opts.fetchImpl ?? fetch;
    this.#now = opts.now ?? (() => Date.now());
    this.#skew = opts.refreshSkewMs ?? 5000;
  }

  async getToken(): Promise<string> {
    const now = this.#now();
    if (this.#cached && this.#cached.expiresAt - this.#skew > now) return this.#cached.token;

    let res: Response;
    try {
      res = await this.#fetch(this.#cfg.tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.#cfg.clientId,
          client_secret: this.#cfg.clientSecret,
          ...(this.#cfg.scope ? { scope: this.#cfg.scope } : {}),
        }).toString(),
      });
    } catch (e) {
      throw new AdapterError('auth', `token request failed: ${errMessage(e)}`);
    }
    if (!res.ok) throw new AdapterError('auth', `token endpoint returned ${res.status}`, res.status);

    const json = (await res.json().catch(() => ({}))) as TokenResponse;
    if (!json.access_token) throw new AdapterError('auth', 'token endpoint returned no access_token');
    this.#cached = { token: json.access_token, expiresAt: now + (json.expires_in ?? 3600) * 1000 };
    return this.#cached.token;
  }
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
