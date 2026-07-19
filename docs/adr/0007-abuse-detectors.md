# ADR 0007 — Abuse detectors as evidence producers

- Status: accepted
- Date: 2026-07-19

## Context

Sentinel (ADR-0006) is an exchange for accountable abuse *signals* but ships no
detectors — reports came from outside. The first detectors sit directly on top of
provenance (digests, CDC fingerprints) and perceptual hashing: reused/stolen
content and impersonation. The risk is that a detector's output reads as a
verdict; it must not.

## Decision

1. **Detectors emit evidence, never verdicts.** A `Detection` always carries a
   `confidence` (strength of match, not probability of guilt), an explicit
   `disposition` including `inconclusive`/`no_match`, benign `alternatives` a human
   must rule out, and the detector's `limitations`.
2. **Reused-content detection** (`ReuseIndex`) matches a candidate against
   registered passports by exact digest (certain), CDC fuzzy fingerprint
   (byte-level edits) and perceptual dHash (image re-encode/resize). Content
   matched to its own owner is never flagged.
3. **Impersonation detection** (`ImpersonationIndex`): handle/domain look-alikes
   via a confusable skeleton (homoglyph) + edit distance (typosquat), and
   perceptual likeness of profile images. An identical name is `inconclusive`, not
   impersonation — common names recur.
4. **Positive detections bridge to Sentinel** as SIGNED reports/linkage edges, so
   a detector's finding enters the exchange as one accountable, quorum-gated,
   appealable signal. A detector cannot corroborate anything by itself.
5. **Uncertainty is preserved end-to-end** — the report's mandatory uncertainty
   field is built from the detection's alternatives + limitations.

## Consequences

- The provenance/perceptual investment now powers real detection, and the whole
  pipeline (detect → sign → exchange → recommend-only signal) is testable and
  benchmarked (reuse recall, detector false-positive rate).
- **Limitations (documented):** the corpus is not exhaustive; CDC/perceptual/
  homoglyph matching all have false positives; the confusables map is a curated
  subset of Unicode; likeness is not identity; audio/video and at-scale monitoring
  are not built. The safe default is `inconclusive`, and quorum + appeal remain the
  backstops against acting on a single detector's mistake.
