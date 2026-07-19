/**
 * Impersonation detector.
 *
 * Two signals against a set of protected/verified identities:
 *   - HANDLE / DOMAIN look-alikes: a candidate name or domain that folds to the
 *     same confusable skeleton as a protected one ("paypa1", Cyrillic "pаypal"),
 *     or is within a small edit distance (typosquat). An identical string is NOT
 *     treated as impersonation on its own — many people share a name — it is
 *     `inconclusive`.
 *   - LIKENESS: a candidate profile image perceptually close to a protected
 *     identity's reference image, on a different account (stolen or synthetic).
 *
 * Every result is evidence + confidence with benign alternatives, never a verdict.
 */

import { perceptualSimilarity, type Fingerprint } from '../../media/src/index.ts';
import { skeleton, stringSimilarity, editDistance } from './util.ts';
import type { Detection } from './types.ts';

export interface ProtectedIdentity {
  id: string;
  names: string[];
  domains?: string[];
  imageFingerprint?: Fingerprint;
}

export interface HandleCandidate {
  subjectId: string;
  name?: string;
  domain?: string;
}

export interface LikenessCandidate {
  subjectId: string;
  imageFingerprint: Fingerprint;
}

const HANDLE_LIMITATIONS =
  'Name/handle similarity is a weak signal — common names recur and rebrands happen. Homoglyph/typosquat matches need human confirmation.';

export class ImpersonationIndex {
  #ids: ProtectedIdentity[] = [];

  add(identity: ProtectedIdentity): this {
    this.#ids.push(identity);
    return this;
  }

  get size(): number {
    return this.#ids.length;
  }

  detectHandle(candidate: HandleCandidate): Detection {
    const cands = [candidate.name, candidate.domain].filter((x): x is string => !!x);
    let best: { pid: ProtectedIdentity; protectedStr: string; conf: number; how: string } | null = null;
    const consider = (pid: ProtectedIdentity, protectedStr: string, conf: number, how: string) => {
      if (!best || conf > best.conf) best = { pid, protectedStr, conf, how };
    };

    for (const pid of this.#ids) {
      for (const protectedStr of [...pid.names, ...(pid.domains ?? [])]) {
        for (const c of cands) {
          if (c.toLowerCase() === protectedStr.toLowerCase()) continue; // identical ≠ impersonation
          const skC = skeleton(c);
          const skP = skeleton(protectedStr);
          if (skC === skP) {
            consider(pid, protectedStr, 0.9, 'homoglyph'); // folds to the same skeleton
          } else {
            const d = editDistance(skC, skP);
            const sim = stringSimilarity(skC, skP);
            if (d <= 2 && sim >= 0.8) consider(pid, protectedStr, Math.min(0.85, sim), 'typosquat');
          }
        }
      }
    }

    if (!best) {
      return {
        category: 'impersonation_handle',
        disposition: 'no_match',
        confidence: 0,
        method: 'impersonation/handle',
        evidence: [],
        subject: candidate.subjectId,
        alternatives: [],
        limitations: HANDLE_LIMITATIONS,
      };
    }
    const b = best as { pid: ProtectedIdentity; protectedStr: string; conf: number; how: string };
    return {
      category: 'impersonation_handle',
      disposition: b.how === 'homoglyph' ? 'match' : 'near_match',
      confidence: b.conf,
      method: `impersonation/handle/${b.how}`,
      evidence: [{ kind: 'lookalike_of', ref: b.pid.id, detail: b.protectedStr }],
      subject: candidate.subjectId,
      matched: b.pid.id,
      alternatives: ['a coincidentally similar but legitimate name', 'a rebrand or authorised variant'],
      limitations: HANDLE_LIMITATIONS,
    };
  }

  detectLikeness(candidate: LikenessCandidate, threshold = 0.85): Detection {
    let best: { pid: ProtectedIdentity; score: number } | null = null;
    for (const pid of this.#ids) {
      if (!pid.imageFingerprint) continue;
      if (pid.id === candidate.subjectId) continue; // same identity — not impersonation
      const score = perceptualSimilarity(candidate.imageFingerprint, pid.imageFingerprint);
      if (score >= threshold && (!best || score > best.score)) best = { pid, score };
    }
    if (!best) {
      return {
        category: 'impersonation_likeness',
        disposition: 'no_match',
        confidence: 0,
        method: 'impersonation/likeness',
        evidence: [],
        subject: candidate.subjectId,
        alternatives: [],
        limitations: 'Perceptual likeness is not identity; it has false positives and does not prove intent or synthesis.',
      };
    }
    const b = best as { pid: ProtectedIdentity; score: number };
    return {
      category: 'impersonation_likeness',
      disposition: 'near_match',
      confidence: b.score,
      method: 'impersonation/likeness/dhash',
      evidence: [{ kind: 'similar_likeness_of', ref: b.pid.id }],
      subject: candidate.subjectId,
      matched: b.pid.id,
      alternatives: ['the same person legitimately using another account', 'a coincidental visual resemblance', 'a licensed use of the image'],
      limitations: 'Perceptual likeness is not identity; it has false positives and does not prove intent or synthesis.',
    };
  }
}
