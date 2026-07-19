/**
 * Abuse-signal exchange — recommend-only, quorum-gated, appealable, logged.
 *
 * Submitting a report requires a valid signature from a TRUSTED reporter; every
 * report/appeal/adjudication is appended to a transparency log (append-only,
 * provable). `signals()` returns evidence and corroboration for a target — and
 * NO verdict. Corroboration requires a QUORUM of distinct trusted reporters; a
 * pending appeal marks a signal CONTESTED; an adjudicated overturn removes the
 * report from the active signal entirely.
 */

import { canonicalBytes, type TrustStore } from '../../core/src/index.ts';
import { TransparencyLog } from '../../transparency/src/index.ts';
import { verifyReport, verifyAppeal, verifyAdjudication } from './report.ts';
import type {
  AbuseReport,
  Appeal,
  Adjudication,
  AbuseTarget,
  AbuseCategory,
  CategorySignal,
  SignalSummary,
  Disposition,
} from './types.ts';

export interface ExchangeOptions {
  /** Distinct trusted reporters required for `corroborated`. Default 2. */
  quorum?: number;
  log?: TransparencyLog;
}

interface Stored {
  report: AbuseReport;
  active: boolean;
}

export class AbuseSignalExchange {
  #reporterTrust: TrustStore;
  #adjudicatorTrust: TrustStore;
  #quorum: number;
  #log: TransparencyLog;
  #reports = new Map<string, Stored>();
  #byTarget = new Map<string, Set<string>>();
  #appeals = new Map<string, Appeal[]>();
  #adjudications = new Map<string, Adjudication>();

  constructor(reporterTrust: TrustStore, adjudicatorTrust: TrustStore, opts: ExchangeOptions = {}) {
    this.#reporterTrust = reporterTrust;
    this.#adjudicatorTrust = adjudicatorTrust;
    this.#quorum = opts.quorum ?? 2;
    this.#log = opts.log ?? new TransparencyLog('origentra-sentinel/1');
  }

  get log(): TransparencyLog {
    return this.#log;
  }

  #tkey(t: AbuseTarget): string {
    return `${t.type}:${t.id}`;
  }

  submit(report: AbuseReport): { accepted: boolean; reason?: string } {
    if (this.#reports.has(report.reportId)) return { accepted: false, reason: 'duplicate' };
    if (!verifyReport(report, this.#reporterTrust)) return { accepted: false, reason: 'untrusted_or_invalid' };
    this.#log.append(canonicalBytes(report));
    this.#reports.set(report.reportId, { report, active: true });
    const k = this.#tkey(report.target);
    const set = this.#byTarget.get(k) ?? new Set<string>();
    set.add(report.reportId);
    this.#byTarget.set(k, set);
    return { accepted: true };
  }

  appeal(appeal: Appeal): { accepted: boolean; reason?: string } {
    if (!this.#reports.has(appeal.reportId)) return { accepted: false, reason: 'unknown_report' };
    if (!verifyAppeal(appeal)) return { accepted: false, reason: 'invalid_signature' };
    this.#log.append(canonicalBytes(appeal));
    const list = this.#appeals.get(appeal.reportId) ?? [];
    list.push(appeal);
    this.#appeals.set(appeal.reportId, list);
    return { accepted: true };
  }

  adjudicate(adj: Adjudication): { accepted: boolean; reason?: string } {
    const stored = this.#reports.get(adj.reportId);
    if (!stored) return { accepted: false, reason: 'unknown_report' };
    if (!verifyAdjudication(adj, this.#adjudicatorTrust)) return { accepted: false, reason: 'untrusted_or_invalid' };
    this.#log.append(canonicalBytes(adj));
    this.#adjudications.set(adj.reportId, adj);
    if (adj.decision === 'overturned') stored.active = false;
    return { accepted: true };
  }

  /** Evidence + corroboration for a target. Never a verdict — consumer decides. */
  signals(target: AbuseTarget): SignalSummary {
    const ids = [...(this.#byTarget.get(this.#tkey(target)) ?? [])];
    const byCat = new Map<AbuseCategory, string[]>();
    for (const id of ids) {
      const r = this.#reports.get(id)!.report;
      const list = byCat.get(r.category) ?? [];
      list.push(id);
      byCat.set(r.category, list);
    }

    const categories: CategorySignal[] = [];
    for (const [category, catIds] of byCat) {
      const activeIds = catIds.filter((id) => this.#reports.get(id)!.active);
      const reporters = new Set(activeIds.map((id) => this.#reports.get(id)!.report.reporterIdentityId));
      const pendingAppeal = activeIds.some(
        (id) => (this.#appeals.get(id)?.length ?? 0) > 0 && !this.#adjudications.has(id),
      );
      const confidences = activeIds.map((id) => this.#reports.get(id)!.report.confidence);
      const confidence = confidences.length ? Math.max(...confidences) : 0;
      const quorumMet = reporters.size >= this.#quorum;

      let disposition: Disposition;
      if (activeIds.length === 0) {
        disposition = catIds.some((id) => this.#adjudications.get(id)?.decision === 'overturned')
          ? 'overturned'
          : 'insufficient_evidence';
      } else if (pendingAppeal) {
        disposition = 'contested';
      } else if (quorumMet) {
        disposition = 'corroborated';
      } else {
        disposition = 'single_source';
      }

      const adjs = catIds.map((id) => this.#adjudications.get(id)).filter(Boolean) as Adjudication[];
      let appealStatus: CategorySignal['appealStatus'] = 'none';
      if (adjs.some((a) => a.decision === 'overturned')) appealStatus = 'overturned';
      else if (adjs.some((a) => a.decision === 'upheld')) appealStatus = 'upheld';
      else if (catIds.some((id) => (this.#appeals.get(id)?.length ?? 0) > 0)) appealStatus = 'pending';

      categories.push({
        category,
        activeReports: activeIds.length,
        distinctReporters: reporters.size,
        quorumMet,
        confidence,
        disposition,
        evidenceRefs: activeIds.flatMap((id) => this.#reports.get(id)!.report.evidence.map((e) => e.ref)),
        appealStatus,
      });
    }

    return {
      target,
      categories,
      disclaimer: 'evidence-only; not an enforcement decision; consumer decides and is accountable',
    };
  }
}
