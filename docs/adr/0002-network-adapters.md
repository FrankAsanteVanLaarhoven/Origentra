# ADR 0002 — Network publication adapters: async contract, resilience, honest boundaries

- Status: accepted
- Date: 2026-07-19

## Context

Milestone 6 adds the ability to publish over a network to a third-party platform.
This is exactly the surface my earlier risk analysis flagged as the deepest
execution risk: platform APIs are flaky, rate-limited, credential-gated and
hostile to automation. The adapter must be resilient, and the project must not
overstate what it can do without operator credentials and a live endpoint.

## Decision

1. **Widen `PublicationAdapter.execute` to `ExecutionReceipt | Promise<…>`.**
   Network I/O is asynchronous; the simulated and local adapters remain
   synchronous and still satisfy the contract. Callers holding the interface
   `await` the result.
2. **`buildReceipt` accepts an explicit `externalRef`.** A real platform returns
   its own post id; the receipt records that id rather than a locally-derived
   stand-in. Local/simulated adapters keep deriving a ref from a `scheme`.
3. **Only a confirmed 2xx yields a signed `executed` receipt.** Any unconfirmed
   outcome (auth failure, rate-limit exhaustion, outage, timeout) throws a
   categorised `AdapterError` — we never sign a receipt for something that may
   not have happened.
4. **Resilience is built in:** OAuth2 bearer auth via a `TokenProvider` (with a
   caching client-credentials provider), an `Idempotency-Key` header so retries
   are safe, exponential backoff on 5xx/429 (honouring `Retry-After`), and a
   per-request timeout via `AbortController`.
5. **Verified against a mock platform, not a live API.** The mock server injects
   auth requirements, transient failures, rate limits, delays and idempotency, so
   the adapter's behaviour is exercised end-to-end over real HTTP without
   touching a third party. The LinkedIn adapter is a correct *configuration*
   (UGC ShareContent mapping) that would work with credentials; it is not run
   live and makes no such claim (see `docs/CLAIMS.md`).

## Consequences

- The hard engineering (auth, retries, idempotency, failure semantics) is real
  and tested; going live is a matter of supplying credentials and a live endpoint
  (Milestone 6b), plus LinkedIn media-upload mapping.
- Idempotency correctness depends on the platform honouring the `Idempotency-Key`
  header; platforms that do not require a different dedup strategy.
- There is no auto-refresh on a mid-flight 401 (the token provider refreshes
  proactively on expiry); a 401 is treated as terminal. Revisit if a platform
  invalidates tokens unpredictably.
