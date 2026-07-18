/**
 * HTTP witness transport — the network implementation of WitnessTransport.
 *
 * Talks to an Origentra witness service (apps/witness). Used by a log operator
 * to collect cosignatures and by an auditor to compare witness views across the
 * network. Zero dependencies (global fetch).
 */

import type { WitnessTransport, WitnessView } from './gossip.ts';
import type { CosignResult } from './witness.ts';
import type { SignedCheckpoint, ConsistencyProofResult } from './log.ts';

export interface WitnessIdentity {
  keyId: string;
  publicKeyPem: string;
}

export class HttpWitnessTransport implements WitnessTransport {
  readonly keyId: string;
  #base: string;
  #fetch: typeof fetch;

  constructor(base: string, keyId: string, fetchImpl: typeof fetch = fetch) {
    this.#base = base.replace(/\/$/, '');
    this.keyId = keyId;
    this.#fetch = fetchImpl;
  }

  /** Discover a witness's identity and open a transport to it. */
  static async connect(base: string, fetchImpl: typeof fetch = fetch): Promise<HttpWitnessTransport> {
    const res = await fetchImpl(base.replace(/\/$/, '') + '/witness');
    if (!res.ok) throw new Error(`witness discovery failed: ${res.status}`);
    const id = (await res.json()) as WitnessIdentity;
    return new HttpWitnessTransport(base, id.keyId, fetchImpl);
  }

  async cosign(cp: SignedCheckpoint, consistencyProof?: ConsistencyProofResult): Promise<CosignResult> {
    const res = await this.#fetch(this.#base + '/cosign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checkpoint: cp, consistencyProof }),
    });
    if (!res.ok) return { accepted: false, reason: `http_${res.status}` };
    return (await res.json()) as CosignResult;
  }

  async latest(logId: string): Promise<WitnessView | null> {
    const res = await this.#fetch(this.#base + '/latest?logId=' + encodeURIComponent(logId));
    if (!res.ok) return null;
    const j = (await res.json()) as { view: WitnessView | null };
    return j.view ?? null;
  }
}
