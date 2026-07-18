# Limitations & known gaps

Declared honestly, per the project discipline. A limitation here is not a bug;
it is a boundary of what Milestone 1 claims.

## Provenance / fingerprinting

- The fuzzy fingerprint (`cdc-gear-v1`) is a **content-defined-chunking** hash.
  It survives byte-level edits, insertion, deletion, truncation and re-ordering
  of embedded data. It does **not** survive transformations that change every
  byte while preserving perceptual content — image re-encoding, resizing,
  colour-space changes, audio resampling, video transcoding.
- Perceptual **image** hashing (dHash) is implemented in `@origentra/media` and
  survives re-encode, downscale and brightness shift; it is **not** robust to
  heavy crop, rotation or flips. Perceptual hashing for **audio** (chromaprint)
  and **video** (frame-hash sequences) is the production path for those media and
  is **not implemented**. The `Fingerprint` interface carries multiple algorithms
  so these slot in without a schema change.
- **Global text rewrites** (normalizing all whitespace or case) change nearly
  every byte and are known-hard for CDC — SocialTrust-Bench reports ~0% recovery
  for them (transparently, un-gated). A perceptual/normalizing text fingerprint
  is the fix and is not yet implemented.
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
- Two adapters exist: `SimulatedAdapter` (in-memory, no I/O) and the real
  `LocalPublishAdapter` (filesystem, crash-safe on-disk idempotency). Neither
  posts to a third-party **network** platform — that requires credentials and is
  a later milestone. The local adapter's idempotency is per-directory; a
  clustered deployment needs a shared idempotency store.

## Network adapters

- `@origentra/adapters` provides a resilient HTTP adapter (OAuth2, retry/backoff,
  timeout, idempotency) and a LinkedIn UGC body mapping. Both are verified
  **against a mock platform only** — nothing has run against a live third-party
  API, which needs the operator's credentials and a live endpoint.
- Idempotency relies on the platform honouring the `Idempotency-Key` header.
- No auto-refresh on a mid-flight `401`; the token provider refreshes proactively
  on expiry and a `401` is treated as terminal.
- LinkedIn: **text shares only**. Image/video shares need LinkedIn's separate
  register-upload-attach media flow, which is not implemented.

## Persistence & verifier

- The durable store is **file-backed JSONL** with in-memory indexes. It enforces
  the tenant-isolation contract (fuzzy recovery is tenant-scoped) but is not a
  hardened database; production uses PostgreSQL with row-level security.
- The public verifier's trust anchor is "signers that have published to this
  instance." That is honest but narrow; a real deployment federates trust across
  issuers and publishes revocation status.

## Benchmark

- SocialTrust-Bench is **self-measured** on a self-defined, deterministic corpus.
  It proves reproducibility and catches regressions; it is not third-party audit.
  Independent replication on an external corpus is the goal.

## Audit & transparency log

- The core audit hash chain (`@origentra/core` `audit.ts`) is tamper-evident
  **within a log instance**.
- `@origentra/transparency` adds a Merkle log with signed checkpoints and
  inclusion/consistency proofs, so append-only-ness is provable between any two
  checkpoints and the head is independently verifiable.
- **Witnessing & gossip:** the cosigning primitive, an HTTP witness service, a
  client transport, checkpoint distribution and a split-view auditor all exist and
  are tested over loopback — a witness cosigns only append-only extensions, and an
  auditor comparing witness views catches a log that showed different heads.
  **However**, there is no *deployed* multi-operator federation: no witness
  discovery/registry, no continuously-running gossip/re-audit daemon, and trust
  in witnesses is configured, not federated. Running that network is future work.
- **Anchoring:** `FileAnchor` is a real local append-only anchor. An external
  (blockchain / third-party timestamp) anchor is a matching `Anchor` implementation
  that is **not** built.
- **Durability:** the transparency log can be file-backed (leaf hashes appended,
  reconstructed on restart). The core audit chain and the revocation index are
  still in-memory, and none of these is a hardened database. PostgreSQL with
  row-level security remains a later milestone (the file stores enforce the same
  isolation contract in the meantime).
- Revocation is honoured only for entries signed by a trusted key; there is no
  automated distribution/subscription protocol yet — a verifier loads revocation
  entries from a supplied source.

## Tooling

- `npm run typecheck` requires installing TypeScript (`npm i -D typescript`).
  The code is written in erasable-syntax-only style so Node runs the `.ts`
  sources directly via type stripping; runtime behaviour is validated by the
  test suite, which is the primary correctness gate.

## Not present at all (see README "Deliberately not built yet")

Cross-platform reuse / impersonation monitoring at scale, deepfake / synthetic-
media detection, credentialed **network** platform integrations, audio/video
perceptual hashing, and enterprise controls (SAML/SCIM/CMK/data-residency).
