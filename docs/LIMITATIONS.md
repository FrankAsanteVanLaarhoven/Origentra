# Limitations & known gaps

Declared honestly, per the project discipline. A limitation here is not a bug;
it is a boundary of what Milestone 1 claims.

## Provenance / fingerprinting

- The fuzzy fingerprint (`cdc-gear-v1`) is a **content-defined-chunking** hash.
  It survives byte-level edits, insertion, deletion, truncation and re-ordering
  of embedded data. It does **not** survive transformations that change every
  byte while preserving perceptual content — image re-encoding, resizing,
  colour-space changes, audio resampling, video transcoding.
- Domain-specific perceptual hashing (pHash/dHash for images, chromaprint for
  audio, frame-hash sequences for video) is the production path for those media
  and is **not implemented**. The `Fingerprint` interface is designed to carry
  multiple algorithms so these slot in without a schema change.
- The default chunk parameters are tuned for small text/data assets in tests.
  Real deployments must tune `maskBits`/`min`/`maxChunk` per media type and
  publish the parameters (they are part of interoperability).

## Identity

- Issuing an identity claim asserts a binding; it does **not** prove real-world
  identity. Real assurance (document checks, domain control, social-account
  proof) is an external step whose evidence Origentra records but does not yet
  implement here.
- Revocation is represented as a marker on the claim. There is no distributed
  revocation list / status endpoint yet; a verifier only sees revocation if it
  is handed the revoked claim.

## Rights

- Rights evaluation matches **asserted** records against a requirement. It does
  not verify that the asserted evidence is genuine, nor resolve disputes. A
  `disputed` flag blocks publication but is set by a caller, not adjudicated.

## Policy & execution

- Risk scoring (0–6) uses a fixed, transparent factor model. It is a *policy
  default*, not an empirically validated risk model; organisations are expected
  to configure it. The mapping is deliberately explainable rather than learned.
- The platform adapter is **simulated**. Idempotency is enforced in-process via
  an in-memory map; a durable deployment needs a persistent idempotency store.

## Audit

- The hash chain is tamper-evident **within a log instance**. Detecting tampering
  you were never shown requires periodically publishing the head hash (and
  optionally anchoring it externally). That publication mechanism is not built.
- The log is in-memory; durability and append-only storage are a later milestone.

## Tooling

- `npm run typecheck` requires installing TypeScript (`npm i -D typescript`).
  The code is written in erasable-syntax-only style so Node runs the `.ts`
  sources directly via type stripping; runtime behaviour is validated by the
  test suite, which is the primary correctness gate.

## Not present at all (see README "Deliberately not built yet")

Web UI / public verifier site, multi-tenant persistence, cross-platform reuse
monitoring, deepfake detection, real platform integrations, enterprise controls
(SAML/SCIM/CMK/data-residency), and the SocialTrust-Bench harness.
