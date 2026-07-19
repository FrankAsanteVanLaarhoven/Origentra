/**
 * Audio / video reuse detectors.
 *
 * Same shape and discipline as the text/image ReuseIndex: index registered
 * assets' perceptual fingerprints (acoustic hash for audio, frame-hash sequence
 * for video), then detect whether a candidate published by another account
 * matches. Audio matches by robust-hash similarity; video by CONTAINMENT (are the
 * candidate's frames present in a reference clip). Output is evidence, never a
 * verdict; the owner's own content is never flagged.
 */

import {
  audioFingerprint,
  audioSimilarity,
  videoFingerprint,
  videoContainment,
  type PcmAudio,
  type RawImage,
  type Fingerprint,
} from '../../media/src/index.ts';
import type { Detection, DetectionCategory } from './types.ts';

const ALTERNATIVES = [
  'may be a licensed or authorised re-use',
  'may be the same owner on another account',
  'perceptual match may be coincidental',
];
const LIMITATIONS =
  'Perceptual audio/video matching has false positives; a match is evidence of reuse, not proof of theft. Input is PCM / extracted frames — container/codec decoding is out of scope.';

function positive(method: string, subjectId: string, assetId: string, ownerId: string, score: number): Detection {
  return {
    category: 'content_reuse' as DetectionCategory,
    disposition: score >= 0.999 ? 'match' : 'near_match',
    confidence: score,
    method,
    evidence: [{ kind: 'matched_asset', ref: assetId, detail: `owner:${ownerId}; similarity:${score.toFixed(3)}` }],
    subject: subjectId,
    matched: assetId,
    alternatives: ALTERNATIVES,
    limitations: LIMITATIONS,
  };
}

function negative(method: string, subjectId: string): Detection {
  return {
    category: 'content_reuse',
    disposition: 'no_match',
    confidence: 0,
    method,
    evidence: [],
    subject: subjectId,
    alternatives: [],
    limitations: LIMITATIONS,
  };
}

interface Entry {
  assetId: string;
  ownerId: string;
  fp: Fingerprint;
}

export interface AudioCandidate {
  subjectId: string;
  publisherIdentityId: string;
  audio: PcmAudio;
}

export class AudioReuseIndex {
  #entries: Entry[] = [];

  get size(): number {
    return this.#entries.length;
  }

  add(assetId: string, ownerId: string, audio: PcmAudio): this {
    this.#entries.push({ assetId, ownerId, fp: audioFingerprint(audio) });
    return this;
  }

  detect(candidate: AudioCandidate, threshold = 0.75): Detection {
    const fp = audioFingerprint(candidate.audio);
    let best: { e: Entry; s: number } | null = null;
    for (const e of this.#entries) {
      if (e.ownerId === candidate.publisherIdentityId) continue;
      const s = audioSimilarity(fp, e.fp);
      if (s >= threshold && (!best || s > best.s)) best = { e, s };
    }
    return best
      ? positive('audio-fp/acoustic-hk', candidate.subjectId, best.e.assetId, best.e.ownerId, best.s)
      : negative('audio-fp/acoustic-hk', candidate.subjectId);
  }
}

export interface VideoCandidate {
  subjectId: string;
  publisherIdentityId: string;
  frames: RawImage[];
}

export class VideoReuseIndex {
  #entries: Entry[] = [];

  get size(): number {
    return this.#entries.length;
  }

  add(assetId: string, ownerId: string, frames: RawImage[]): this {
    this.#entries.push({ assetId, ownerId, fp: videoFingerprint(frames) });
    return this;
  }

  detect(candidate: VideoCandidate, threshold = 0.8): Detection {
    const fp = videoFingerprint(candidate.frames);
    let best: { e: Entry; s: number } | null = null;
    for (const e of this.#entries) {
      if (e.ownerId === candidate.publisherIdentityId) continue;
      const s = videoContainment(fp, e.fp); // candidate contained in reference
      if (s >= threshold && (!best || s > best.s)) best = { e, s };
    }
    return best
      ? positive('video-fp/framehash', candidate.subjectId, best.e.assetId, best.e.ownerId, best.s)
      : negative('video-fp/framehash', candidate.subjectId);
  }
}
