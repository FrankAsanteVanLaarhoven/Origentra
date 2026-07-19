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
npm test                             # 169 tests across all packages
npm run bench                        # SocialTrust-Bench v0.1 (22 KPIs)
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
    fft.ts              zero-dependency radix-2 FFT
    audio.ts            acoustic hash (Haitsma-Kalker) + WAV PCM parse
    video.ts            frame-hash-sequence fingerprint (containment matching)
packages/adapters/      @origentra/adapters — network publication adapters
    token.ts            OAuth2 token providers (static + client-credentials + cache)
    http-adapter.ts     resilient HTTP adapter (retry/backoff/timeout/idempotency)
    linkedin.ts         LinkedIn UGC body mapping (config-only; not run live)
packages/transparency/  @origentra/transparency — verifiable log + revocation
    merkle.ts           RFC 6962 Merkle: inclusion + consistency proofs
    log.ts              signed checkpoints + proof results; durable (file-backed)
    revocation.ts       trust-gated, log-recorded revocation registry
    witness.ts          witness cosigning + fork / split-view detection
    gossip.ts           checkpoint distribution + split-view audit (transport-agnostic)
    http-transport.ts   HTTP witness client
    anchor.ts           external anchoring interface + local file anchor
packages/sentinel/      @origentra/sentinel — recommend-only abuse-signal exchange
    report.ts           signed reports/appeals/adjudications/linkage
    linkage.ts          sock-puppet cluster graph (confidence-scored evidence)
    exchange.ts         quorum-gated, appealable, transparency-logged; NO verdict
packages/detectors/     @origentra/detectors — abuse detectors that feed Sentinel
    reuse.ts            reused/stolen-content detection (digest + CDC + perceptual)
    av.ts               audio/video reuse detection (acoustic hash + frame-hash)
    impersonation.ts    homoglyph/typosquat handles + perceptual likeness
    report.ts           bridge: positive detection → signed Sentinel signal
packages/enterprise/    @origentra/enterprise — enterprise controls
    cmk.ts              customer-managed keys — AES-256-GCM envelope encryption
    sso.ts              OIDC/JWT ID-token verification → scoped identity
    scim.ts             SCIM 2.0 provisioning (issue/revoke identities)
    governance.ts       legal hold (fail-closed) + SIEM (CEF) export
apps/cli/               reference CLI + end-to-end demo
apps/witness/           Origentra Witness — node:http witness service
apps/verifier/          Origentra Verify — node:http public verifier + inline UI
apps/scim/              Origentra SCIM — node:http provisioning endpoint
bench/                  SocialTrust-Bench v0.1 — 22-KPI reproducible harness
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
- **Recommend-only abuse signals.** The abuse-signal exchange shares accountable,
  quorum-gated, appealable *evidence* — never an enforcement verdict. Consuming
  platforms decide and are accountable. Origentra never bans or blocks accounts.

---

## Deliberately *not* built yet

Per the project's own scope discipline (prove one narrow, complete loop first),
these are later milestones and are **not** present or claimed:

- **Live** platform integrations. The network adapter (OAuth2, retry, timeout,
  idempotency) and a LinkedIn body mapping exist and are tested against a *mock*
  platform — but nothing has run against a real LinkedIn/YouTube/Instagram/TikTok
  API. That needs the operator's credentials and a live endpoint (Milestone 6b),
  and LinkedIn media (non-text) shares are not yet mapped.
- Cross-platform reuse / impersonation monitoring *at scale*. Detectors for text,
  image, **audio and video** plus the recommend-only exchange are built and tested;
  large-scale continuous monitoring across platforms is not. AV detectors consume
  PCM / extracted frames — MP3/AAC/MP4/H.264 decoding is out of scope.
- Robustness to heavy **crop/rotation** (image and video), and Chromaprint/
  AcoustID compatibility. Audio (acoustic hash) and video (frame-hash) perceptual
  fingerprints and their reuse detectors are built and tested — on PCM / extracted
  frames; see [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md).
- **XML SAML SSO, external KMS/HSM, and PostgreSQL row-level security.** SSO
  (OIDC/JWT), SCIM provisioning, customer-managed envelope encryption, legal hold
  and SIEM export are built and tested; SAML XML-DSig, AWS/GCP-KMS integration and
  a hardened RLS database are not (the reference stores are file-backed but enforce
  the same isolation contract).
- Independent third-party benchmark replication.

---

## Roadmap

| Milestone | Scope | Status |
| --- | --- | --- |
| **1. Trust core** | identity, passport, provenance, rights, policy, execution, audit — real crypto, tested | ✅ done |
| **2. Public verifier + persistence** | node:http verifier, durable tenant-isolated store | ✅ done |
| **3. Perceptual media** | zero-dep PNG codec + dHash (image survivability) | ✅ done |
| **4. Real adapter** | non-simulated local publishing adapter behind the shared contract | ✅ done |
| **5. SocialTrust-Bench v0.1** | 22-KPI reproducible benchmark, each mapped to a failure mode | ✅ done |
| **6. Network adapter transport** | OAuth2 + retry/backoff/timeout/idempotency HTTP adapter + LinkedIn mapping, tested vs. a mock platform | ✅ done |
| **7. Transparency log + revocation** | RFC 6962 Merkle log, signed checkpoints, inclusion/consistency proofs, trust-gated revocation consulted by the verifier | ✅ done |
| **8. Witnessing + durable log** | witness cosigning (refuses non-append-only heads), fork/split-view detection, file-backed durable log | ✅ done |
| **8b. Gossip transport + anchoring** | HTTP witness service, client transport, checkpoint distribution, split-view auditor, local checkpoint anchor | ✅ done |
| **9. Abuse-signal exchange** | recommend-only, quorum-gated, appealable, transparency-logged evidence sharing + sock-puppet linkage — never a verdict | ✅ done |
| **10. Abuse detectors** | reused/stolen-content (digest + CDC + perceptual) + impersonation (homoglyph/typosquat + likeness), bridging to signed Sentinel signals | ✅ done |
| **11. Audio/video detectors** | FFT acoustic hash + frame-hash video fingerprint + AV reuse detection (on PCM / extracted frames) | ✅ done |
| **12. Enterprise controls** | customer-managed keys (envelope encryption + rotation), OIDC/JWT SSO, SCIM provisioning, legal hold + SIEM export | ✅ done |
| 6b. Live platform integration | run the LinkedIn/YouTube adapter against the real API with operator credentials | planned |
| 8c. Witness federation + on-chain anchor | deployed multi-operator witnesses, discovery/registry, external anchoring | planned |
| 12b. SAML + hardened storage | XML SAML SSO, external KMS/HSM, PostgreSQL row-level security, real codec decode | planned |

## License

MIT © Frank Asante Van Laarhoven
