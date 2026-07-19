# ADR 0008 — Audio/video perceptual detectors

- Status: accepted
- Date: 2026-07-19

## Context

The reuse/impersonation detectors (ADR-0007) covered text and images. Extending
to audio and video needs perceptual fingerprints for those media, following the
same "evidence, not verdict" discipline, and staying zero-dependency.

## Decision

1. **Acoustic fingerprint (`media/audio.ts`)** — a Haitsma-Kalker-style robust
   hash on PCM: frame → Hann window → FFT (`media/fft.ts`, a real zero-dep radix-2
   Cooley-Tukey) → log-spaced sub-band energies → a 32-bit sub-fingerprint per
   frame from the SIGN of energy differences across bands and time. That
   construction is inherently robust to volume, EQ and lossy re-encoding.
   Similarity is 1 − bit-error-rate over aligned frames with a small offset search.
2. **Video fingerprint (`media/video.ts`)** — a sequence of per-frame dHashes.
   Matching is by CONTAINMENT (fraction of one clip's frames with a near-duplicate
   in another), which survives re-encode/resize/brightness (per-frame dHash) and
   tolerates clip subsetting, extra frames and mild re-timing (set-wise matching).
3. **AV reuse detectors (`detectors/av.ts`)** — `AudioReuseIndex` /
   `VideoReuseIndex` mirror the text/image `ReuseIndex`: index owners' fingerprints,
   detect a candidate published by another account, skip the owner's own content,
   emit a `Detection` (evidence + confidence + alternatives + limitations), and
   bridge to a signed Sentinel signal.

## Consequences

- Reuse detection now spans text, image, audio and video, all feeding the same
  recommend-only, quorum-gated, appealable exchange.
- **Input boundary (documented):** detectors consume PCM samples and extracted
  frames. A minimal 16-bit PCM WAV parser is provided; MP3/AAC/Opus decoding and
  MP4/H.264 demuxing are NOT implemented — decode/extract first. Chromaprint /
  AcoustID compatibility is not claimed (independent hash of the same family).
  Heavy crop/rotation defeats the video hash; thresholds are tunable defaults.
