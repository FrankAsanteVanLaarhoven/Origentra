/**
 * Origentra Response — incident evidence packs.
 *
 * An evidence pack is the exportable record assembled when misuse is detected.
 * Its value depends on completeness, so this module defines the required fields
 * and a completeness score. It records evidence; it does not draw legal
 * conclusions and never auto-submits legal notices.
 */

import type { RightsRecord, VerificationState } from './types.ts';

export interface TimelineEvent {
  at: string;
  event: string;
}

export interface EvidencePack {
  incidentId: string;
  tenantId: string;
  affectedIdentityId: string;
  affectedAssetIds: string[];
  detectionSource: string;
  timeline: TimelineEvent[];
  assetDigests: string[];
  similarityScores: number[];
  provenanceStates: VerificationState[];
  rightsRecords: RightsRecord[];
  humanDecision?: string;
  containmentActions: string[];
  outcome?: string;
  evidenceStatus?: 'complete' | 'partial' | 'inconclusive';
}

interface RequiredField {
  field: keyof EvidencePack;
  /** True when the field carries usable evidence. */
  present: (p: EvidencePack) => boolean;
}

const REQUIRED: RequiredField[] = [
  { field: 'incidentId', present: (p) => !!p.incidentId },
  { field: 'tenantId', present: (p) => !!p.tenantId },
  { field: 'affectedIdentityId', present: (p) => !!p.affectedIdentityId },
  { field: 'affectedAssetIds', present: (p) => p.affectedAssetIds.length > 0 },
  { field: 'detectionSource', present: (p) => !!p.detectionSource },
  { field: 'timeline', present: (p) => p.timeline.length > 0 },
  { field: 'assetDigests', present: (p) => p.assetDigests.length > 0 },
  { field: 'provenanceStates', present: (p) => p.provenanceStates.length > 0 },
  { field: 'humanDecision', present: (p) => !!p.humanDecision },
  { field: 'containmentActions', present: (p) => p.containmentActions.length > 0 },
  { field: 'outcome', present: (p) => !!p.outcome },
];

export interface EvidenceCompleteness {
  complete: boolean;
  score: number; // fraction in [0,1]
  missing: string[];
}

export function evidenceCompleteness(pack: EvidencePack): EvidenceCompleteness {
  const missing = REQUIRED.filter((r) => !r.present(pack)).map((r) => String(r.field));
  const score = (REQUIRED.length - missing.length) / REQUIRED.length;
  return { complete: missing.length === 0, score, missing };
}

export const REQUIRED_EVIDENCE_FIELDS = REQUIRED.map((r) => String(r.field));
