/**
 * Witness registry — discovery and operator mapping for a federation.
 *
 * A federation's strength comes from INDEPENDENT operators, so each witness record
 * carries an `operator`. Federation quorum counts distinct operators (not just
 * distinct keys), so one operator running many witnesses cannot fake a quorum.
 */

import { TrustStore } from '../../core/src/index.ts';

export interface WitnessRecord {
  keyId: string;
  publicKeyPem: string;
  /** The independent organisation operating this witness. */
  operator: string;
  /** HTTP endpoint of the witness service, if reachable over the network. */
  url?: string;
}

export class WitnessRegistry {
  #records = new Map<string, WitnessRecord>();

  add(record: WitnessRecord): this {
    this.#records.set(record.keyId, record);
    return this;
  }

  get(keyId: string): WitnessRecord | undefined {
    return this.#records.get(keyId);
  }

  list(): WitnessRecord[] {
    return [...this.#records.values()];
  }

  /** Distinct operators represented in the registry. */
  operators(): string[] {
    return [...new Set(this.list().map((r) => r.operator))];
  }

  get size(): number {
    return this.#records.size;
  }

  /** A trust store of every registered witness key. */
  trustStore(): TrustStore {
    const t = new TrustStore();
    for (const r of this.#records.values()) t.add(r.keyId, r.publicKeyPem);
    return t;
  }

  static fromRecords(records: WitnessRecord[]): WitnessRegistry {
    const reg = new WitnessRegistry();
    for (const r of records) reg.add(r);
    return reg;
  }
}
