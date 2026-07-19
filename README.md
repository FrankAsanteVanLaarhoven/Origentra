<div align="center">

# Origentra Passport OS

### The platform-neutral trusted control plane for digital content

**Secure every identity · Prove every asset · Control every release**

![License](https://img.shields.io/badge/license-MIT-2563eb)
![Node](https://img.shields.io/badge/node-%E2%89%A5%2022-339933)
![Runtime deps](https://img.shields.io/badge/core%20runtime%20deps-0-16a34a)
![Tests](https://img.shields.io/badge/tests-184%20passing-16a34a)
![SocialTrust-Bench](https://img.shields.io/badge/SocialTrust--Bench-23%2F23-16a34a)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)

</div>

---

Origentra is the **security, ownership and governance layer for digital content** —
the infrastructure through which trustworthy content is authorised, verified,
protected and commercialised. It verifies **who** is acting, establishes **what**
they own, controls **what** may be published, preserves **how** content was
created, detects misuse, and supports accountable response.

Content generation is becoming cheap and interchangeable. Verified identity,
provable provenance, governed publication and accountable evidence are not.
Origentra is that layer — infrastructure that creators, agencies, enterprises and
platforms build on, **not** another scheduler, dashboard or caption generator.

> **Reference implementation** — 13 **zero-dependency** TypeScript packages on the
> Node.js standard library, **184 tests**, and a **23-KPI reproducible benchmark**,
> every metric mapped to a specific failure mode. A conventional Next.js
> control-plane **dashboard** consumes them.
>
> **New here?** Read [`docs/OVERVIEW.md`](docs/OVERVIEW.md) — the full platform
> narrative and architecture for stakeholders.

---

## Why Origentra

| Principle | What it means |
| --- | --- |
| **Deterministic governance** | The policy engine never calls a model. An AI agent may *propose*; a deterministic authority *decides*, fails **closed**, and an agent can never publish high-risk content or self-approve. Same inputs → same decision → auditable. |
| **Evidence, not verdicts** | Discrete verification states and confidence with explicit uncertainty — never a single opaque "trust score", and never automated enforcement. Consumers decide and are accountable. |
| **Verifiable & tamper-evident** | Ed25519-signed Content Passports, an RFC 6962 Merkle transparency log with signed checkpoints, inclusion/consistency proofs, revocation and witness cosigning. |
| **Tenant-isolated & least-privilege** | Strict tenant isolation and scoped identities throughout; data minimisation by design (hashes and signals, not raw media or dossiers). |
| **Honest by construction** | Every capability maps to code and tests, or it is a *prohibited* claim. Limitations and failed approaches are documented, not hidden. |

---

## Capabilities

| Capability | Package | Summary |
| --- | --- | --- |
| Identity & authority | `@origentra/core` | Signed identity claims, scopes, delegation, expiry, revocation |
| Content Passport & provenance | `@origentra/core` | Ed25519-signed manifests; exact + fuzzy + perceptual recovery; discrete states |
| Rights & consent | `@origentra/core` | Machine-readable assertions; fail-closed publication; evidence, not legal conclusions |
| Governed execution | `@origentra/core` | Deterministic, fail-closed policy engine; idempotent signed receipts |
| Durable, tenant-isolated storage | `@origentra/store` | Append-only persistence; tenant-scoped recovery; real local publishing adapter |
| Perceptual fingerprinting | `@origentra/media` | Zero-dep PNG codec, image dHash, FFT acoustic hash, video frame-hash |
| Network publishing | `@origentra/adapters` | Resilient HTTP adapter (OAuth2, retry, timeout, idempotency) + LinkedIn mapping |
| Transparency, witnessing & revocation | `@origentra/transparency` | Merkle log, checkpoints, proofs, revocation, witness cosigning, gossip, anchoring |
| Abuse-signal exchange | `@origentra/sentinel` | **Recommend-only**, quorum-gated, appealable, transparency-logged; sock-puppet linkage |
| Abuse detectors | `@origentra/detectors` | Reused-content (text/image/audio/video) + impersonation → signed evidence |
| Enterprise controls | `@origentra/enterprise` | Customer-managed keys, OIDC/JWT SSO, SCIM, legal hold, SIEM export |
| Biometric consent gate | `@origentra/enrolment` | Granular consent-gated references; withdrawal → crypto-shred (Article 9 by design) |
| Control-plane UI | `apps/dashboard` | Next.js dashboard with live analytics wired to real hash-chained events |

---

## Security & compliance posture

- **Cryptography** — Ed25519 signatures, SHA-256 digests, AES-256-GCM envelope
  encryption with customer-managed keys and rotation.
- **Access** — tenant isolation, least-privilege scopes, separation of duties,
  fail-closed authorisation, agents can never authorise high-risk actions.
- **Integrity** — tamper-evident audit + RFC 6962 transparency log, signed
  checkpoints, witness cosigning and fork/split-view detection.
- **Enterprise** — OIDC/JWT SSO, SCIM 2.0 provisioning, legal hold, SIEM (CEF) export.
- **Privacy** — data-minimised signals, biometric consent gate with crypto-shred;
  a DPIA / Article 9 / LIA / privacy-notice package is prepared and requires DPO
  sign-off before high-risk processing.
- **No unaudited claims** — Origentra states no certifications it has not
  independently obtained. See [`docs/CLAIMS.md`](docs/CLAIMS.md) and
  [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md).

---

## Quickstart

Requires Node ≥ 22.6. The core has **zero runtime dependencies** — nothing to install.

```bash
node apps/cli/origentra.ts demo      # the complete control loop, end-to-end
npm test                             # 184 tests (+1 gated live) across all packages
npm run bench                        # SocialTrust-Bench v0.1 — 23 KPIs
npm run serve                        # Origentra Verify on http://localhost:8787
```

### Control-plane dashboard

```bash
node_modules/.bin/next dev apps/dashboard   # http://localhost:3000
```

Dark/light/system theming, 20 languages (RTL), live analytics wired to **real
hash-chained Origentra events**, world clock, weather, FX, and a
transparency-first UI.

---

## Benchmark — SocialTrust-Bench v0.1

A deterministic, reproducible **23-KPI** benchmark; every KPI maps to a failure
mode and hard-gate KPIs exit non-zero, so it doubles as a CI gate. It spans
passport validity, provenance survivability, unauthorised-publication prevention,
agent approval-bypass (0 / 10,000 adversarial traces), transparency-log
consistency, witness fork detection, abuse-signal integrity, detector accuracy,
CMK integrity, SSO validation, and biometric consent gating — **all passing**.

> Self-measured on a self-defined corpus: a reproducibility and regression tool,
> not third-party audit. Independent replication is the goal.

---

## Integrity & honest scope

Origentra maintains a **claims register** ([`docs/CLAIMS.md`](docs/CLAIMS.md)) that
separates evidence-backed *permitted* claims from *prohibited* ones. In this
repository: the network adapter is verified against a **mock** platform (nothing
has run against a live third-party API); detection is never certain; a passport
proves provenance, not truth; and biometric processing requires a lawful basis the
code does not itself provide. Failed approaches are documented, not deleted.

---

## Documentation

| Document | Purpose |
| --- | --- |
| [`docs/OVERVIEW.md`](docs/OVERVIEW.md) | Platform overview & architecture (start here) |
| [`docs/CLAIMS.md`](docs/CLAIMS.md) | Claims register — permitted vs prohibited |
| [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md) | Declared limitations & known gaps |
| [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md) | Trust boundaries, threats & mitigations |
| [`docs/SOCIALTRUST-BENCH.md`](docs/SOCIALTRUST-BENCH.md) | Benchmark methodology |
| [`docs/GO-LIVE.md`](docs/GO-LIVE.md) | Runbook for live platform publishing |
| [`docs/adr/`](docs/adr) | Architecture Decision Records |

---

## License

MIT © Frank Asante Van Laarhoven
