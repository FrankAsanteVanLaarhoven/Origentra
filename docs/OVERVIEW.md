# Origentra Passport OS — Platform Overview & Architecture

**Secure every identity. Prove every asset. Control every release.**

This document ties the whole platform together for stakeholders — what it is, why
it exists, how the parts compose, what is genuinely built, and what is honestly
not. It is the single narrative on top of the per-capability docs (`CLAIMS.md`,
`THREAT-MODEL.md`, `SOCIALTRUST-BENCH.md`, the ADRs).

---

## 1. What it is

Origentra is the **platform-neutral trusted control plane for digital content**.
It verifies *who* is acting, establishes *what* they own, controls *what* may be
published, preserves *how* content was created, detects misuse, and supports
accountable response — as an **infrastructure layer** other tools, creators,
agencies, enterprises and platforms build on, not another scheduler or dashboard.

The reference implementation is **13 zero-dependency TypeScript packages** and
**4 applications** running on the Node.js standard library, exercised by **183
tests** and a **23-KPI reproducible benchmark**, every one of which maps to a
specific failure mode.

## 2. The thesis

Content generation is becoming cheap and interchangeable. **Verified identity,
provable provenance, governed publication and accountable evidence are not.**
Origentra does not compete with generation or scheduling tools; it provides the
security, ownership and governance layer they — and the platforms themselves —
can use. The defensible position is *infrastructure*: the graphs of identity,
rights, lineage, publication authority and enforcement evidence, plus an open,
reproducible benchmark.

## 3. What it protects — the lifecycle

```
identity → creation → rights & consent → provenance → simulation → approval
        → publication → verification → transparency → monitoring
        → detection → abuse-signal exchange → response → accountability
```

Every stage is backed by real cryptography and a fail-closed governance model,
and every claim is bounded by an honest limitations register.

## 4. Architecture at a glance

A **modular monolith** — deliberately. Small, composable packages; no premature
microservices; **zero runtime dependencies** (the smallest possible supply chain
for a security/signing system, and a clean interoperability reference).

| Package | Role |
| --- | --- |
| `@origentra/core` | Reference trust primitives: canonical JSON, SHA-256, Ed25519, identity, Content Passport, rights, **deterministic policy engine**, governed execution, tamper-evident audit, evidence packs |
| `@origentra/store` | Durable, **tenant-isolated** persistence + a real local publishing adapter |
| `@origentra/media` | Perceptual fingerprinting: PNG codec, image dHash, **FFT + acoustic hash**, video frame-hash |
| `@origentra/adapters` | Resilient network publication (OAuth2, retry/backoff, timeout, idempotency) + LinkedIn mapping |
| `@origentra/transparency` | RFC 6962 Merkle log, signed checkpoints, inclusion/consistency proofs, revocation, **witnessing**, gossip, anchoring |
| `@origentra/sentinel` | **Recommend-only** abuse-signal exchange: quorum-gated, appealable, transparency-logged; sock-puppet linkage |
| `@origentra/detectors` | Reuse (text/image/**audio**/**video**) + impersonation (homoglyph/likeness) → signed Sentinel signals |
| `@origentra/enterprise` | Customer-managed keys, OIDC/JWT SSO, SCIM provisioning, legal hold, SIEM export |
| `@origentra/enrolment` | Biometric **consent gate**: granular signed consent, consent-gated references, withdrawal → crypto-shred |
| **apps** | `verifier` (public verification), `witness` (checkpoint cosigning), `scim` (provisioning), `cli`/`publisher` (demo + governed go-live) |

## 5. The complete control loop (the vertical slice)

The founding milestone proves one narrow, complete loop end-to-end — all
cryptographically real:

```
identity → asset → digest → signed Content Passport → public verify
        → publication proposal → deterministic fail-closed policy (risk 0–6)
        → human approval → idempotent execution + signed receipt
        → transformed-copy provenance recovery → tamper-evident audit
```

`node apps/cli/origentra.ts demo` runs the whole thing.

## 6. Capabilities by domain

- **Identity** — signed identity claims with scopes, delegation, expiry,
  revocation; a signature proves *integrity*, only a trusted signer proves
  *authority*.
- **Content Passport & provenance** — Ed25519-signed manifests; layered recovery
  (exact digest → content-defined fuzzy fingerprint → perceptual hash); discrete
  verification states, **never a single trust score**.
- **Rights & consent** — machine-readable assertions (ownership, licences,
  likeness/voice consent, minor-guardian, AI-training); **evidence, not legal
  conclusions**; publication fails closed on missing/expired/revoked/disputed
  rights.
- **Governed execution** *(the defensible core)* — a **deterministic, model-free
  policy engine**: an AI agent may *propose*, but a separate authority *decides*,
  fails closed, and an agent can never publish high-risk content or self-approve.
- **Publishing** — one contract for simulated, local and real network adapters;
  a governed-publish runner and a credentials-gated go-live path (`docs/GO-LIVE.md`).
- **Public verification** — an `Origentra Verify` server returns evidence states,
  vouching only for signers that published to it, and reflects revocation.
- **Transparency & tamper-evidence** — a Merkle log with signed checkpoints,
  inclusion + append-only consistency proofs, revocation distribution, **witness
  cosigning** (refuses forks/rollbacks), split-view auditing, and local anchoring.
- **Abuse-signal exchange** — **recommend-only** by construction (no verdict
  field): shares accountable evidence with quorum, appeal, overturn and
  transparency-logging; consuming platforms decide and are accountable.
- **Abuse detectors** — reused/stolen content across text, image, audio and video,
  plus homoglyph/typosquat and perceptual-likeness impersonation; every output is
  evidence + confidence + alternatives + an explicit inconclusive state.
- **Enterprise controls** — customer-managed envelope encryption (+ rotation),
  OIDC/JWT SSO → scoped identity, SCIM provisioning (issue/revoke), legal hold
  (fail-closed), SIEM export.
- **Biometric consent gate** — the Article 9 privacy-by-design gate: references
  are hash-only, CMK-encrypted, obtainable only under active consent, and
  crypto-shredded on withdrawal.

## 7. Design principles (non-negotiable)

1. **Deterministic authority** — the policy engine never calls a model; same
   inputs → same decision → auditable and reproducible.
2. **Fail closed** — any unsatisfiable check → BLOCK.
3. **Agents propose, humans authorise** high-risk; agents never self-approve.
4. **Evidence, not verdicts** — discrete states, confidence + uncertainty;
   Origentra never enforces or bans — consumers decide and are accountable.
5. **Recommend-only abuse signals** — with quorum, appeal and transparency.
6. **Tenant isolation** everywhere; **least privilege** scopes.
7. **Data minimisation** — hashes and signals, not raw media or dossiers.
8. **Honesty discipline** — every claim maps to evidence, or it is prohibited.

## 8. The moat

Not the models. The **verified-identity, rights-and-consent, asset-lineage,
publication-authority and threat/enforcement graphs**, plus **open reproducible
benchmark leadership** and an interoperable reference (open signer + verifier).
The most defensible near-term wedge is **governed agent execution** — the part
that does not depend on hostile platform APIs and answers a real, growing need as
autonomous agents start acting and publishing.

## 9. Measurement — SocialTrust-Bench v0.1

A deterministic, reproducible **23-KPI** benchmark; each KPI maps to a failure
mode; hard-gate KPIs exit non-zero so it doubles as a CI gate. It spans passport
validity, provenance survivability (text + image), rights false-negative/positive,
unauthorised-publication prevention, agent approval-bypass (0 / 10,000 adversarial
traces), publishing reliability, cross-tenant isolation, decision determinism,
transparency-log consistency, witness fork detection, abuse-signal integrity,
recommend-only invariant, detector recall/false-positive, AV reuse detection, CMK
integrity, SSO validation, and biometric consent gating. **All 23 pass.**

> Honesty caveat: SocialTrust-Bench is *self-measured* on a self-defined corpus —
> a reproducibility and regression tool, not third-party audit. Independent
> replication is the goal.

## 10. Honesty & claims discipline

`docs/CLAIMS.md` is a contract: a **permitted-claims** table (each backed by code
+ tests) and a **prohibited-claims** list. Nothing publishes to a live third-party
API in this repo; detection is never certain; a passport proves provenance, not
truth; biometric processing needs a lawful basis this code does not itself
provide. Failed approaches are documented, not deleted (`docs/LIMITATIONS.md`).

## 11. Status & roadmap

**Built and tested (13 milestones):** trust core · verifier + persistence ·
perceptual media · real + network adapters · SocialTrust-Bench · transparency log
+ revocation · witnessing + durable log · gossip + anchoring · abuse-signal
exchange · detectors (text/image/audio/video + impersonation) · enterprise
controls · biometric consent gate · governed go-live runner.

**Ready — awaiting your input:**
- **Go live** (6b): supply LinkedIn OAuth credentials; the governed publisher runs
  the real post (`docs/GO-LIVE.md`).
- **Biometric detectors**: technically gated behind the consent gate; needs DPO /
  legal sign-off on the Article 9 basis before Phase 2 (non-biometric detectors
  ship now).

**Planned (needs infrastructure):** deployed multi-operator witness federation +
on-chain anchoring (8c); XML SAML SSO, external KMS/HSM, PostgreSQL row-level
security, real container/codec decode (12b); at-scale cross-platform monitoring.

## 12. Compliance posture

Because the platform can process identity, facial, voice, impersonation and
behavioural data, a **DPIA**, an **Article 9 / consent design**, a **Legitimate
Interests Assessment** and a **privacy notice** have been prepared (held in a
private governance workspace, not this public repo) and require DPO/legal sign-off.
Origentra's own design supplies several mitigations directly: recommend-only +
human decisioning (Article 22), data-minimised signals, CMK encryption, appeal,
and a tamper-evident transparency log as the accountability record.

## 13. How to run it

```bash
node apps/cli/origentra.ts demo      # the whole control loop, end-to-end
npm test                             # 183 tests (+1 gated live) across all packages
npm run bench                        # SocialTrust-Bench v0.1 — 23 KPIs
npm run serve                        # Origentra Verify on http://localhost:8787
```

MIT © Frank Asante Van Laarhoven
