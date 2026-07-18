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
node --test 'packages/core/test/*.test.ts'   # 50 tests
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
apps/cli/               reference CLI + end-to-end demo
docs/                   CLAIMS · LIMITATIONS · THREAT-MODEL · ADRs
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

- Real platform integrations (LinkedIn, YouTube, Instagram, TikTok).
- Cross-platform reuse / impersonation monitoring at scale (the "Sentinel"
  arms-race surface).
- Domain-specific perceptual hashing (pHash for images, chromaprint for audio,
  frame-hash sequences for video). The current fingerprint survives byte-level
  edits, not re-encoding — see [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md).
- Web UI / public verifier site, multi-tenant persistence, enterprise controls
  (SAML/SCIM/CMK), and the SocialTrust-Bench harness.

---

## Roadmap

| Milestone | Scope | Status |
| --- | --- | --- |
| **1. Trust core** | identity, passport, provenance, rights, policy, execution, audit — real crypto, tested | ✅ this repo |
| 2. Public verifier + persistence | web verifier, durable manifest/fingerprint store, RLS tenancy | planned |
| 3. SocialTrust-Bench v0.1 | reproducible provenance-survivability + adversarial policy benchmark | planned |
| 4. Perceptual media | image/audio/video perceptual fingerprints | planned |
| 5. Platform adapters | one real adapter behind the same interface | planned |

## License

MIT © Frank Asante Van Laarhoven
