# Origentra Passport OS

**Secure every identity. Prove every asset. Control every release.**

Origentra is the platform-neutral **trusted control plane for digital content**:
it verifies *who* is acting, establishes *what* they own, controls *what* may be
published, preserves *how* content was created, detects misuse, and supports
accountable response.

Content generation is becoming cheap and interchangeable. Verified identity,
provable provenance, governed publication and accountable evidence are not.
Origentra is the security, ownership and governance layer — not another
scheduler, dashboard or caption generator.

> This repository is an independent project. It is unrelated to, and shares no
> code with, any other application in this workspace.

---

## What is real in this repository (Milestone 1)

Everything here is **cryptographically real** — real Ed25519 signatures, real
SHA-256 digests, a real deterministic policy decision, a real hash-chained audit
log. There are **zero runtime dependencies**; the entire core runs on the Node.js
standard library (Node ≥ 22.6).

The one thing that is *deliberately simulated*, and says so everywhere, is the
**platform adapter**: it performs no network I/O and publishes to no real
platform. See [`docs/CLAIMS.md`](docs/CLAIMS.md) for the exact list of claims
this codebase is and is not permitted to make.

### The complete vertical slice

```
identity → asset → digest → Content Passport → public verify
        → publication proposal → deterministic policy → human approval
        → idempotent execution + signed receipt
        → transformed-copy detection → tamper-evident evidence
```

Run it:

```bash
node apps/cli/origentra.ts demo      # the whole loop, end-to-end
npm test                             # 82 tests across all packages
npm run bench                        # SocialTrust-Bench v0.1 (13 KPIs)
npm run serve                        # Origentra Verify on http://localhost:8787
```

Other CLI commands operate on real files:

```bash
node apps/cli/origentra.ts keygen
node apps/cli/origentra.ts digest <file>
node apps/cli/origentra.ts verify <file> <passport.json> [--trust <keyId>]
```

---

## Architecture

A **modular monolith** — deliberately. No premature microservices; one package
holds the reference trust primitives, one app drives them.

```
packages/core/          @origentra/core — the open reference implementation
  src/
    canonical.ts        deterministic (JCS-style) JSON serialisation
    digest.ts           sha256 content digests
    keys.ts             Ed25519 keygen / detached signatures / key ids
    trust.ts            trust store (a signature proves integrity; trust proves authority)
    identity.ts         Origentra Identity — signed identity claims + scopes
    fingerprint.ts      content-defined-chunking fuzzy fingerprint (survivability)
    passport.ts         Origentra Passport — Content Passport sign/verify → discrete states
    store.ts            passport store with layered (exact → fuzzy) recovery
    rights.ts           Origentra Rights — assertion/consent evaluation (fail-closed)
    policy.ts           Origentra Control — the DETERMINISTIC policy engine (risk 0–6)
    execution.ts        governed execution — approvals, authorisation, idempotent receipts
    audit.ts            tamper-evident append-only hash-chained log
    evidence.ts         Origentra Response — incident evidence packs + completeness
packages/store/         @origentra/store — durable tenant-isolated persistence
    manifests.ts        append-only passport store; recover() is tenant-scoped
    publish.ts          real LocalPublishAdapter (fs I/O, crash-safe idempotency)
packages/media/         @origentra/media — perceptual fingerprinting
    png.ts              zero-dependency PNG decode/encode (node:zlib)
    perceptual.ts       dHash + hamming/similarity (survives re-encode/resize/brightness)
packages/adapters/      @origentra/adapters — network publication adapters
    token.ts            OAuth2 token providers (static + client-credentials + cache)
    http-adapter.ts     resilient HTTP adapter (retry/backoff/timeout/idempotency)
    linkedin.ts         LinkedIn UGC body mapping (config-only; not run live)
apps/cli/               reference CLI + end-to-end demo
apps/verifier/          Origentra Verify — node:http public verifier + inline UI
bench/                  SocialTrust-Bench v0.1 — 13-KPI reproducible harness
docs/                   CLAIMS · LIMITATIONS · THREAT-MODEL · SOCIALTRUST-BENCH · ADRs
```

### Design commitments

- **The policy engine never calls a model.** An AI agent may *propose* an action;
  a deterministic authority independently *decides*. Same inputs → same decision.
- **Fail closed.** Any check that cannot be satisfied → `BLOCK`.
- **An AI agent can never publish high-risk content directly, and can never be an
  approver.** High-risk requires a human holding `publish:approve`.
- **Discrete verification states, never a single "trust score."** A verifier
  receives evidence and decides for itself. A valid signature proves *integrity*;
  only a trusted signer proves *authority*.
- **Evidence, not legal conclusions.** Rights records are assertions with
  evidence and status — Origentra does not adjudicate legal ownership.

---

## Deliberately *not* built yet

Per the project's own scope discipline (prove one narrow, complete loop first),
these are later milestones and are **not** present or claimed:

- **Live** platform integrations. The network adapter (OAuth2, retry, timeout,
  idempotency) and a LinkedIn body mapping exist and are tested against a *mock*
  platform — but nothing has run against a real LinkedIn/YouTube/Instagram/TikTok
  API. That needs the operator's credentials and a live endpoint (Milestone 6b),
  and LinkedIn media (non-text) shares are not yet mapped.
- Cross-platform reuse / impersonation monitoring at scale (the "Sentinel"
  arms-race surface).
- Perceptual hashing for **audio and video** (chromaprint, frame-hash sequences),
  and image robustness to heavy crop/rotation. Image re-encode/resize/brightness
  are covered; see [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md).
- Enterprise controls (SAML/SCIM/CMK/data-residency), a hardened database with
  row-level security (the reference store is file-backed but enforces the same
  isolation contract), and independent third-party benchmark replication.

---

## Roadmap

| Milestone | Scope | Status |
| --- | --- | --- |
| **1. Trust core** | identity, passport, provenance, rights, policy, execution, audit — real crypto, tested | ✅ done |
| **2. Public verifier + persistence** | node:http verifier, durable tenant-isolated store | ✅ done |
| **3. Perceptual media** | zero-dep PNG codec + dHash (image survivability) | ✅ done |
| **4. Real adapter** | non-simulated local publishing adapter behind the shared contract | ✅ done |
| **5. SocialTrust-Bench v0.1** | 13-KPI reproducible benchmark, each mapped to a failure mode | ✅ done |
| **6. Network adapter transport** | OAuth2 + retry/backoff/timeout/idempotency HTTP adapter + LinkedIn mapping, tested vs. a mock platform | ✅ done |
| 6b. Live platform integration | run the LinkedIn/YouTube adapter against the real API with operator credentials | planned |
| 7. Perceptual audio/video + enterprise controls | chromaprint/frame-hash, SAML/SCIM/CMK | planned |

## License

MIT © Frank Asante Van Laarhoven
