# Claims register

The discipline: **every claim maps to evidence in this repository, or it is
prohibited.** This register is the contract for what marketing, docs and demos
may assert about Milestone 1. It is updated as capabilities land.

## Permitted claims (evidence-backed)

| Claim | Evidence |
| --- | --- |
| Content Passports are signed with Ed25519 and verify deterministically. | `src/passport.ts`, `test/passport.test.ts`, `test/crypto.test.ts` |
| Verification returns discrete evidence states, not a single trust score. | `VerificationState` in `src/types.ts`; `verifyPassport` returns a state set |
| A tampered manifest fails verification. | `test/passport.test.ts` → "tampered manifest fails signature" |
| Byte-identical copies recover provenance exactly. | `test/passport.test.ts`, `src/store.ts` |
| Localised transformations of an asset can still be recovered (fuzzy). | `test/passport.test.ts` → fuzzy recovery; `test/crypto.test.ts` → survivability |
| The policy engine is deterministic: identical inputs → identical decision. | `test/policy.test.ts` → "deterministic … identical decision digests" |
| Publication fails closed on missing/expired/revoked/disputed rights. | `src/rights.ts`, `src/policy.ts`, `test/policy.test.ts`, `test/rights.test.ts` |
| Cross-tenant assets are blocked (tenant isolation). | `test/policy.test.ts` → "cross-tenant asset is BLOCKed" |
| An AI agent cannot publish high-risk content directly and cannot approve. | `src/policy.ts`, `src/execution.ts`, `test/policy.test.ts`, `test/execution.test.ts` |
| Undisclosed AI-involved or unknown-origin content is blocked. | `test/policy.test.ts` → AI-disclosure cases |
| Execution is idempotent (one side effect per idempotency key). | `src/execution.ts`, `test/execution.test.ts` |
| The audit log is tamper-evident (any edit/re-order breaks the chain). | `src/audit.ts`, `test/audit.test.ts` |
| The core has zero runtime dependencies. | `package.json`, `packages/core/package.json` (`dependencies: {}`) |
| Persistence is tenant-isolated: one tenant cannot recover/enumerate another's assets. | `@origentra/store` `DurableManifestStore`, `test/manifests.test.ts` |
| An approver from another tenant can never authorise a publication. | `src/execution.ts` (`approver_wrong_tenant`), `test/execution.test.ts` |
| A real (non-simulated) local adapter publishes with crash-safe on-disk idempotency. | `@origentra/store` `LocalPublishAdapter`, `test/publish.test.ts` |
| The public verifier vouches only for signers that have published to it. | `apps/verifier` trust anchor, `apps/verifier/test/verifier.test.ts` |
| Perceptual image fingerprints survive re-encode, downscale and brightness shift. | `@origentra/media`, `test/perceptual.test.ts` |
| All 13 SocialTrust-Bench KPIs pass on the reference harness (reproducible). | `bench/socialtrust-bench.ts`, `docs/SOCIALTRUST-BENCH.md` |
| A resilient HTTP adapter (OAuth2, retry/backoff, timeout, idempotency header) publishes end-to-end against a mock platform. | `@origentra/adapters`, `test/http-adapter.test.ts` |
| A network publish that is not confirmed throws a categorised error — it never signs a fake "executed" receipt. | `src/errors.ts`, `src/http-adapter.ts`, `test/http-adapter.test.ts` |
| The LinkedIn UGC ShareContent body mapping is implemented and verified against a mock endpoint. | `src/linkedin.ts`, `test/http-adapter.test.ts` |
| Inclusion proofs verify an entry is in the log; consistency proofs prove append-only growth; a rewritten history fails. | `@origentra/transparency` `merkle.ts`, `test/merkle.test.ts` (exhaustive) |
| Transparency-log checkpoints are signed and verify only under a trusted key. | `src/log.ts`, `test/log.test.ts` |
| A revocation is honoured only when signed by a trusted key, and is itself recorded in the transparency log. | `src/revocation.ts`, `test/revocation.test.ts` |
| A published passport can be revoked after issuance; the public verifier then reports CREDENTIAL_REVOKED. | `apps/verifier`, `apps/verifier/test/verifier.test.ts` |
| A witness cosigns only append-only extensions; rollbacks and forks are refused; a split view is directly detectable. | `src/witness.ts`, `test/witness.test.ts` |
| A witnessed checkpoint is trustworthy only with a quorum of trusted witness cosignatures. | `verifyWitnessed`, `test/witness.test.ts` |
| The transparency log is durable — it reconstructs from disk with the same root and valid proofs. | `src/log.ts` (file mode), `test/durable.test.ts` |
| Witnesses cosign over HTTP; a log operator distributes a checkpoint to a witness quorum. | `apps/witness`, `src/http-transport.ts`, `src/gossip.ts`, `apps/witness/test` |
| An auditor querying witnesses detects a split view (a log that showed different heads). | `auditSplitView`, `test/gossip.test.ts`, `apps/witness/test` |
| A checkpoint root can be anchored to a local append-only anchor and verified under trust. | `src/anchor.ts`, `test/anchor.test.ts` |
| Abuse reports are signed; only trusted reporters are admitted; corroboration needs a quorum of *distinct* trusted reporters. | `@origentra/sentinel`, `test/exchange.test.ts` |
| A target can appeal (open); a pending appeal marks a signal contested; an overturned report leaves the active signal. | `src/exchange.ts`, `test/exchange.test.ts` |
| Reports, appeals and adjudications are transparency-logged (append-only). | `src/exchange.ts` (log), `test/exchange.test.ts` |
| The exchange is recommend-only: its output carries evidence + a disclaimer and never an enforcement verdict field. | `test/exchange.test.ts`, SocialTrust-Bench "Recommend-only invariant" |
| Sock-puppet linkage yields confidence-scored clusters (evidence of correlation, not a hard identity claim). | `src/linkage.ts`, `test/linkage.test.ts` |
| Reused-content detection flags exact copies (certain) and transformed copies (near-match) across accounts, never the owner's own content. | `@origentra/detectors` `reuse.ts`, `test/reuse.test.ts` |
| Impersonation detection catches homoglyph/typosquat handles and perceptual likeness; identical names alone are inconclusive. | `src/impersonation.ts`, `test/impersonation.test.ts` |
| A positive detection bridges to a signed Sentinel signal; a detector alone is single_source, never corroborated. | `src/report.ts`, `test/bridge.test.ts` |
| On the synthetic bench: reuse recall 100%, detector false-positive rate 0% on unrelated content. | SocialTrust-Bench "Reuse-detection recall" / "Detector false-positive rate" |

## Prohibited claims (NOT supported by this codebase)

- ❌ "Origentra publishes to the live LinkedIn / YouTube / Instagram / TikTok
  APIs." — a real HTTP network adapter and a LinkedIn body mapping exist and are
  verified against a **mock** platform, but nothing here has been run against a
  live third-party API. Doing so requires the operator's own credentials and a
  live endpoint. `LocalPublishAdapter` is real but local; `SimulatedAdapter` does
  no I/O. (LinkedIn media shares are also not mapped — text only.)
- ❌ "SocialTrust-Bench proves Origentra is secure / audited." — it is
  **self-measured** on a self-defined corpus (reproducibility/regression tool,
  not third-party audit; see `docs/SOCIALTRUST-BENCH.md`).
- ❌ "Provenance survives any text transformation." — global rewrites
  (whitespace/case normalization) are known-hard for CDC and score ~0%.
- ❌ "Origentra determines legal ownership / clears rights conclusively." — it
  manages **assertions and evidence**, not legal determinations.
- ❌ "Origentra detects deepfakes / synthetic media." — no synthetic-media
  detector exists here; AI involvement is a *declared* field, not detected.
- ❌ "Provenance survives any transformation." — the current fingerprint
  survives byte-level edits, **not** re-encoding/resampling (see LIMITATIONS).
- ❌ "Origentra monitors the whole internet for reuse." — no crawling or
  platform monitoring is implemented.
- ❌ "A valid passport proves the content is true." — a passport proves
  provenance and integrity, **not** factual truth.
- ❌ "Origentra operates a deployed multi-operator witness federation." — the
  gossip *transport* (witness HTTP service, client, distribution, split-view
  audit) exists and is tested over loopback, but there is no continuously-running
  federation of independent operators, no witness discovery/registry, and no
  automatic re-audit daemon. Deploying and federating that is future work.
- ❌ "Origentra anchors checkpoints to an external blockchain / third-party
  timestamp." — only a **local** file anchor exists; an external/on-chain anchor
  is a matching implementation of the `Anchor` interface that is not built.
- ❌ "Origentra bans, blocks or enforces against accounts, or does so across
  platforms." — the abuse-signal exchange is **recommend-only**; it shares
  evidence and a consuming platform decides and is accountable. There is no
  enforcement field in the system.
- ❌ "Origentra proves an account is malicious, or that two accounts are the same
  person." — it shares evidence, corroboration and confidence; linkage is
  probabilistic correlation, not a conclusive identity determination.
- ❌ "A single report (or one reporter) is a corroborated signal." — corroboration
  requires a quorum of *distinct* trusted reporters.
- ❌ "A detector proves theft / impersonation / that an account is malicious." —
  a detector emits *evidence* with confidence and benign alternatives; a match is
  evidence of reuse/similarity, not proof of intent. Near-matches carry false
  positives, the safe default is `inconclusive`, and a detector alone never
  corroborates (Sentinel quorum + appeal still apply).
- ❌ "Origentra detects abuse across all media." — the detectors cover text/CDC
  and image (perceptual) reuse plus handle/likeness impersonation; audio, video,
  and at-scale cross-platform monitoring are not built.
- ❌ Any certification/compliance claim (SOC 2, ISO, GDPR-certified, etc.) — none
  has been independently obtained.

## Rule

A capability may move from *prohibited* to *permitted* only when: requirements
exist, threats are mapped, tenant isolation is tested, tests pass, limitations
are declared, and reproduction commands exist. Failed approaches stay documented
(see `docs/LIMITATIONS.md`), never deleted.
