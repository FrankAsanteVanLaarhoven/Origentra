/**
 * Detector output types.
 *
 * A Detection is EVIDENCE, never a verdict. It always carries a confidence, an
 * explicit disposition (including `inconclusive` / `no_match`), benign
 * `alternatives`, and the detector's `limitations`. Only a positive detection
 * (match / near_match) can be turned into a Sentinel report, and even then it
 * enters the exchange as one accountable, appealable, quorum-gated signal.
 */

export type DetectionCategory =
  | 'content_reuse'
  | 'impersonation_handle'
  | 'impersonation_likeness'
  | 'sock_puppet_link';

export type DetectionDisposition = 'match' | 'near_match' | 'inconclusive' | 'no_match';

export interface DetectionEvidence {
  kind: string;
  ref: string;
  detail?: string;
}

export interface Detection {
  category: DetectionCategory;
  disposition: DetectionDisposition;
  /** Strength of the match in [0,1]; NOT a probability of guilt. */
  confidence: number;
  method: string;
  evidence: DetectionEvidence[];
  /** The candidate being examined (account / asset id). */
  subject: string;
  /** The protected entity matched, if any. */
  matched?: string;
  /** Benign explanations a human must rule out (licensed reuse, coincidence, ...). */
  alternatives: string[];
  /** Known limitations / calibration caveats of this detector. */
  limitations: string;
}

export function isPositive(d: Detection): boolean {
  return d.disposition === 'match' || d.disposition === 'near_match';
}
