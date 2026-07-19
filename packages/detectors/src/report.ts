/**
 * Bridge from detector output to Sentinel.
 *
 * A positive Detection becomes a SIGNED, accountable AbuseReport (or a linkage
 * edge). It then enters the exchange as one quorum-gated, appealable signal — a
 * detector cannot, by itself, corroborate anything. The report's mandatory
 * uncertainty field is populated from the detection's alternatives + limitations,
 * so no signal ever loses its caveats.
 */

import { signReport, signLinkage, type AbuseReport, type AbuseCategory, type AbuseTarget, type LinkageEdge } from '../../sentinel/src/index.ts';
import type { KeyPair } from '../../core/src/index.ts';
import { isPositive, type Detection, type DetectionCategory } from './types.ts';

const CATEGORY_MAP: Record<DetectionCategory, AbuseCategory> = {
  content_reuse: 'impersonation',
  impersonation_handle: 'impersonation',
  impersonation_likeness: 'deepfake',
  sock_puppet_link: 'ban_evasion',
};

export interface ReportOptions {
  reportId: string;
  reporterIdentityId: string;
  target: AbuseTarget;
  reportedAt: string;
  /** Override the default category mapping. */
  category?: AbuseCategory;
}

export function detectionToReport(detection: Detection, opts: ReportOptions, key: KeyPair): AbuseReport {
  if (!isPositive(detection)) {
    throw new Error(`cannot report a ${detection.disposition} detection`);
  }
  const uncertainty = [...detection.alternatives, detection.limitations].filter(Boolean).join(' | ');
  return signReport(
    {
      reportId: opts.reportId,
      target: opts.target,
      category: opts.category ?? CATEGORY_MAP[detection.category],
      evidence: detection.evidence.map((e) => ({ kind: e.kind, ref: e.ref, ...(e.detail ? { detail: e.detail } : {}) })),
      method: detection.method,
      confidence: detection.confidence,
      uncertainty,
      reporterIdentityId: opts.reporterIdentityId,
      reportedAt: opts.reportedAt,
    },
    key,
  );
}

/** A shared-content detection between two accounts becomes a linkage edge. */
export function detectionToLinkage(
  detection: Detection,
  accountA: string,
  accountB: string,
  assertedAt: string,
  key: KeyPair,
): LinkageEdge {
  if (!isPositive(detection)) {
    throw new Error(`cannot link on a ${detection.disposition} detection`);
  }
  return signLinkage(
    {
      a: accountA,
      b: accountB,
      basis: detection.method,
      evidenceRef: detection.matched ?? detection.evidence[0]?.ref ?? '',
      confidence: detection.confidence,
      assertedAt,
    },
    key,
  );
}
