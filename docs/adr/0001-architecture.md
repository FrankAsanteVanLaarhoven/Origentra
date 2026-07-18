# ADR 0001 — Trust core: modular monolith, zero-dependency reference, deterministic policy

- Status: accepted
- Date: 2026-07-18

## Context

Origentra Passport OS is a digital-content security and integrity platform. The
temptation is to build the full surface (identity, provenance, rights,
monitoring, detection, attribution, marketplace) across many services and
languages at once. That is the primary execution risk: scope expansion before
one control loop is proven.

## Decision

1. **Prove one narrow, complete control loop first.** Milestone 1 implements
   identity → passport → verify → propose → policy → approve → execute → detect →
   evidence, and nothing else.
2. **Modular monolith, not microservices.** One `@origentra/core` package holds
   the trust primitives; one CLI app drives them. Service boundaries are deferred
   until load and team structure justify them.
3. **Zero-runtime-dependency reference implementation** on the Node.js standard
   library. A security/signing library's supply chain is itself an attack
   surface; the smallest possible one is the most defensible, and it makes the
   package a clean interoperability reference (the "open reference signer +
   verifier").
4. **The policy engine is deterministic and model-free.** An AI agent may
   propose; a deterministic authority decides. Same inputs → same decision →
   auditable, reproducible, explainable. Models never sit in the authorisation
   path.
5. **Fail closed everywhere.** Missing/expired/revoked/disputed inputs, unknown
   signers, cross-tenant assets and unknown AI origin all resolve to `BLOCK`.
6. **Discrete verification states, never a single trust score.** A composite
   score hides uncertainty and creates liability; evidence states let each
   verifier decide.
7. **Evidence, not legal conclusions.** Rights are assertions with status, not
   adjudications.
8. **TypeScript run directly via Node type-stripping** (Node ≥ 22.6),
   erasable-syntax-only, validated by `node:test`. No build step required to run
   or test.

## Consequences

- Fast to run and verify; trivial supply chain; portable reference artefacts.
- Some capabilities the full blueprint envisions are explicitly absent and
  registered as prohibited claims (`docs/CLAIMS.md`) until built.
- Later milestones (persistence, perceptual media, real adapters, enterprise
  controls, benchmark) extend this core along stable interfaces (`Fingerprint`,
  the adapter contract, the trust store) without re-architecting it.
- Choosing Node/TypeScript for the core (rather than the blueprint's Go for the
  control plane) trades some deployment/performance characteristics for a single
  language across core + CLI + future web verifier, and for the zero-dependency
  property. Revisit if/when the control plane needs Go-grade concurrency; the
  wire formats (canonical JSON, Ed25519, the schemas) are language-neutral by
  design so a Go re-implementation can interoperate.
