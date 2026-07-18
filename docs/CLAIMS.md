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

## Prohibited claims (NOT supported by this codebase)

- ❌ "Origentra publishes to LinkedIn / YouTube / Instagram / TikTok." — the
  only real adapter is `LocalPublishAdapter` (local filesystem); no network
  platform adapter exists. `SimulatedAdapter` performs no I/O at all.
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
- ❌ Any certification/compliance claim (SOC 2, ISO, GDPR-certified, etc.) — none
  has been independently obtained.

## Rule

A capability may move from *prohibited* to *permitted* only when: requirements
exist, threats are mapped, tenant isolation is tested, tests pass, limitations
are declared, and reproduction commands exist. Failed approaches stay documented
(see `docs/LIMITATIONS.md`), never deleted.
