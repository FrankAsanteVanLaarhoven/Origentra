/**
 * A configurable mock platform + OAuth token server for exercising the network
 * adapter end-to-end (real HTTP over loopback). Tests mutate `state` to inject
 * auth requirements, transient failures, rate limits, delays and idempotency.
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface InjectedFailure {
  status: number;
  retryAfter?: string;
  delayMs?: number;
}

export interface MockState {
  /** If set, /publish requires exactly `Bearer <expectedToken>`. */
  expectedToken: string | null;
  /** Consumed FIFO before the success path. */
  failures: InjectedFailure[];
  /** idempotency-key -> minted post id. */
  dedup: Map<string, string>;
  publishCalls: { key: string | null; body: unknown; auth: string | null }[];
  tokenCalls: number;
  counter: number;
  accessToken: string;
  tokenExpiresIn: number;
}

export interface MockPlatform {
  base: string;
  state: MockState;
  close: () => Promise<void>;
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const s = Buffer.concat(chunks).toString('utf8');
  try {
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function startMockPlatform(): Promise<MockPlatform> {
  const state: MockState = {
    expectedToken: null,
    failures: [],
    dedup: new Map(),
    publishCalls: [],
    tokenCalls: 0,
    counter: 0,
    accessToken: 'issued-token',
    tokenExpiresIn: 3600,
  };

  const server: Server = createServer((req, res) => {
    void handle(req, res).catch(() => safeEnd(res, 500, { error: 'mock_failure' }));
  });

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (req.method === 'POST' && url.pathname === '/token') {
      state.tokenCalls++;
      await readBody(req);
      return safeEnd(res, 200, { access_token: state.accessToken, expires_in: state.tokenExpiresIn });
    }

    if (req.method === 'POST' && url.pathname === '/publish') {
      const auth = req.headers['authorization'] ?? null;
      const key = (req.headers['idempotency-key'] as string | undefined) ?? null;
      const body = await readBody(req);
      state.publishCalls.push({ key, body, auth });

      if (state.expectedToken !== null && auth !== `Bearer ${state.expectedToken}`) {
        return safeEnd(res, 401, { error: 'unauthorised' });
      }

      const failure = state.failures.shift();
      if (failure) {
        if (failure.delayMs) await sleep(failure.delayMs);
        const headers = failure.retryAfter !== undefined ? { 'retry-after': failure.retryAfter } : undefined;
        return safeEnd(res, failure.status, { error: 'injected', status: failure.status }, headers);
      }

      if (key && state.dedup.has(key)) {
        return safeEnd(res, 200, { id: state.dedup.get(key), deduped: true });
      }
      const id = `post-${++state.counter}`;
      if (key) state.dedup.set(key, id);
      return safeEnd(res, 200, { id });
    }

    return safeEnd(res, 404, { error: 'not_found' });
  }

  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as AddressInfo).port;
  return {
    base: `http://127.0.0.1:${port}`,
    state,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

function safeEnd(res: ServerResponse, status: number, body: unknown, headers?: Record<string, string>) {
  try {
    res.writeHead(status, { 'content-type': 'application/json', ...(headers ?? {}) });
    res.end(JSON.stringify(body));
  } catch {
    // client may have aborted (timeout tests) — ignore write-after-abort.
  }
}
