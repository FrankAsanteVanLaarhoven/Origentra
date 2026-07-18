/**
 * Typed adapter errors.
 *
 * A network publish that does not demonstrably succeed must NOT produce a signed
 * "executed" receipt — we only sign receipts for things that actually happened.
 * Instead the adapter throws a categorised AdapterError so the caller can decide
 * to retry later, alert, or surface the failure. `retriable` records whether the
 * adapter already exhausted its own retries.
 */

export type AdapterErrorCategory =
  | 'auth' // 401/403 or token acquisition failed
  | 'rate_limited' // 429 after retries
  | 'outage' // 5xx after retries
  | 'timeout' // network error / request aborted after retries
  | 'bad_request'; // 4xx we should not retry

export class AdapterError extends Error {
  category: AdapterErrorCategory;
  status: number | undefined;
  retriable: boolean;

  constructor(category: AdapterErrorCategory, message: string, status?: number) {
    super(message);
    this.name = 'AdapterError';
    this.category = category;
    this.status = status;
    // Only outages/rate-limits/timeouts are worth a later retry.
    this.retriable = category === 'outage' || category === 'rate_limited' || category === 'timeout';
  }
}
