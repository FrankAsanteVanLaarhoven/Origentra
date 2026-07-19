/**
 * Reused / stolen content detector.
 *
 * Indexes registered passports (owner + digest + CDC + perceptual fingerprints)
 * and, given a candidate asset published by some account, finds whether it
 * matches content already registered to a DIFFERENT owner. Layered matching:
 * exact digest (certain), CDC fuzzy fingerprint (byte-level edits), perceptual
 * dHash (image re-encode/resize). Content matched to its own owner is not an
 * abuse signal.
 *
 * A positive detection is EVIDENCE of reuse, not proof of theft — the reuse
 * could be licensed, the same person on another account, or (for near-matches)
 * coincidental. Those alternatives ride along in the Detection.
 */

import {
  sha256,
  fingerprint as cdcFingerprint,
  similarity,
  type Fingerprint,
  type Passport,
} from '../../core/src/index.ts';
import { imageFingerprint, perceptualSimilarity } from '../../media/src/index.ts';
import type { Detection } from './types.ts';

interface Entry {
  assetId: string;
  ownerId: string;
  digest: string;
  cdc: Fingerprint;
  perceptual?: Fingerprint;
}

export interface ReuseCandidate {
  subjectId: string;
  publisherIdentityId: string;
  bytes: Buffer | Uint8Array | string;
  contentType?: string;
}

export interface ReuseThresholds {
  cdc?: number; // default 0.6
  perceptual?: number; // default 0.85
}

function tryPerceptual(bytes: Buffer, contentType?: string): Fingerprint | undefined {
  if (contentType !== 'image/png') return undefined;
  try {
    return imageFingerprint(bytes);
  } catch {
    return undefined;
  }
}

export class ReuseIndex {
  #entries: Entry[] = [];

  get size(): number {
    return this.#entries.length;
  }

  addPassport(p: Passport, ownerId: string = p.manifest.creatorIdentityId): this {
    const cdc = p.manifest.fingerprints.find((f) => f.algo === 'cdc-gear-v1');
    const perceptual = p.manifest.fingerprints.find((f) => f.algo === 'dhash-8x8-v1');
    this.#entries.push({
      assetId: p.manifest.assetId,
      ownerId,
      digest: p.manifest.digest,
      cdc: cdc ?? cdcFingerprint(''),
      perceptual,
    });
    return this;
  }

  addRaw(assetId: string, ownerId: string, bytes: Buffer | Uint8Array | string, contentType?: string): this {
    const buf = typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : Buffer.from(bytes);
    this.#entries.push({
      assetId,
      ownerId,
      digest: sha256(buf),
      cdc: cdcFingerprint(buf),
      perceptual: tryPerceptual(buf, contentType),
    });
    return this;
  }

  detect(candidate: ReuseCandidate, thresholds: ReuseThresholds = {}): Detection {
    const buf =
      typeof candidate.bytes === 'string' ? Buffer.from(candidate.bytes, 'utf8') : Buffer.from(candidate.bytes);
    const digest = sha256(buf);
    const cdc = cdcFingerprint(buf);
    const perceptual = tryPerceptual(buf, candidate.contentType);
    const cdcT = thresholds.cdc ?? 0.6;
    const pT = thresholds.perceptual ?? 0.85;

    let best: { entry: Entry; score: number; how: string } | null = null;
    const consider = (entry: Entry, score: number, how: string) => {
      if (!best || score > best.score) best = { entry, score, how };
    };

    for (const e of this.#entries) {
      if (e.ownerId === candidate.publisherIdentityId) continue; // own content — not abuse
      if (e.digest === digest) {
        consider(e, 1, 'exact_digest');
        continue;
      }
      const cs = similarity(cdc, e.cdc);
      if (cs >= cdcT) consider(e, cs, 'cdc');
      if (perceptual && e.perceptual) {
        const ps = perceptualSimilarity(perceptual, e.perceptual);
        if (ps >= pT) consider(e, ps, 'perceptual');
      }
    }

    if (!best) {
      return {
        category: 'content_reuse',
        disposition: 'no_match',
        confidence: 0,
        method: 'reuse-index',
        evidence: [{ kind: 'candidate_digest', ref: digest }],
        subject: candidate.subjectId,
        alternatives: [],
        limitations: 'Absence of a match only means no indexed asset matched; the corpus is not exhaustive.',
      };
    }

    const b = best as { entry: Entry; score: number; how: string };
    return {
      category: 'content_reuse',
      disposition: b.how === 'exact_digest' ? 'match' : 'near_match',
      confidence: b.score,
      method: `reuse-index/${b.how}`,
      evidence: [
        { kind: 'matched_asset', ref: b.entry.assetId, detail: `owner:${b.entry.ownerId}` },
        { kind: 'candidate_digest', ref: digest },
      ],
      subject: candidate.subjectId,
      matched: b.entry.assetId,
      alternatives: [
        'may be a licensed or authorised re-share',
        'may be the same person on another account',
        ...(b.how === 'exact_digest' ? [] : ['near-match may be coincidental']),
      ],
      limitations:
        'Matches content, not intent — a match is evidence of reuse, not proof of theft. CDC/perceptual near-matches carry false positives.',
    };
  }
}
