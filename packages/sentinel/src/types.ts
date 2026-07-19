/**
 * Origentra Sentinel — abuse-signal exchange types.
 *
 * DESIGN INVARIANT (enforced structurally): this system shares accountable
 * EVIDENCE, never an enforcement verdict. There is no "ban" / "block" field
 * anywhere in these types. A consuming platform receives evidence, corroboration
 * and confidence, and makes — and is accountable for — its own decision.
 *
 * Every report, appeal, adjudication and linkage edge is signed, so a bad-faith
 * reporter is attributable; corroboration requires a QUORUM of distinct trusted
 * reporters; a target can APPEAL; and an overturned report stops counting.
 */

import type { SignerRef } from '../../core/src/index.ts';

export type AbuseCategory =
  | 'ban_evasion'
  | 'scam_fraud'
  | 'impersonation'
  | 'deepfake'
  | 'coordinated_harassment';

export interface AbuseTarget {
  type: 'identity' | 'account' | 'domain';
  id: string;
}

export interface AbuseEvidence {
  /** e.g. 'reused_passport', 'linkage_cluster', 'scam_url', 'similar_likeness'. */
  kind: string;
  /** A digest, incident id, url-hash — a pointer to verifiable evidence. */
  ref: string;
  detail?: string;
}

export interface AbuseReport {
  reportId: string;
  target: AbuseTarget;
  category: AbuseCategory;
  evidence: AbuseEvidence[];
  /** Detection method (human review, automated matcher, etc.). */
  method: string;
  /** Reporter's confidence in [0,1]. */
  confidence: number;
  /** Explicit caveats / alternative explanations — required, never empty. */
  uncertainty: string;
  reporterIdentityId: string;
  reportedAt: string;
  signer: SignerRef;
  signature: string;
}

/** A target contesting a report. Open to anyone (due process) — signature only. */
export interface Appeal {
  appealId: string;
  reportId: string;
  appellantId: string;
  statement: string;
  appealedAt: string;
  signer: SignerRef;
  signature: string;
}

/** A trusted adjudicator's resolution of a report/appeal. */
export interface Adjudication {
  reportId: string;
  appealId?: string;
  decision: 'upheld' | 'overturned' | 'insufficient_evidence';
  rationale: string;
  adjudicatorId: string;
  decidedAt: string;
  signer: SignerRef;
  signature: string;
}

/** A signed assertion that two accounts are likely the same actor (probabilistic). */
export interface LinkageEdge {
  a: string;
  b: string;
  /** Basis, e.g. 'reused_passport', 'shared_device', 'coordinated_timing'. */
  basis: string;
  evidenceRef: string;
  /** Confidence in [0,1]. This is EVIDENCE of correlation, not a hard identity claim. */
  confidence: number;
  assertedAt: string;
  signer: SignerRef;
  signature: string;
}

export type Disposition =
  | 'corroborated' // quorum of distinct trusted reporters, not overturned/contested
  | 'contested' // a report has a pending appeal
  | 'single_source' // active report(s) but below quorum
  | 'overturned' // adjudicated overturned; no longer counts
  | 'insufficient_evidence';

export interface CategorySignal {
  category: AbuseCategory;
  activeReports: number;
  distinctReporters: number;
  quorumMet: boolean;
  /** Bounded aggregate (max of active report confidences). */
  confidence: number;
  disposition: Disposition;
  evidenceRefs: string[];
  appealStatus: 'none' | 'pending' | 'upheld' | 'overturned';
}

export interface SignalSummary {
  target: AbuseTarget;
  categories: CategorySignal[];
  /** A permanent reminder to consumers. There is no verdict field, by design. */
  disclaimer: 'evidence-only; not an enforcement decision; consumer decides and is accountable';
}
