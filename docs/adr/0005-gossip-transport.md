# ADR 0005 — Witness gossip transport and external anchoring

- Status: accepted
- Date: 2026-07-19

## Context

ADR-0004 added witness cosigning and split-view *detection* as primitives, but
left the *transport* open: nothing distributed checkpoints to witnesses or let a
client compare witness views over a network. Without that, a fork is only caught
if parties happen to compare cosigned checkpoints by hand.

## Decision

1. **Transport-agnostic gossip (`gossip.ts`).** A `WitnessTransport` interface
   abstracts talking to a witness. `distributeCheckpoint` pushes a checkpoint to
   a set of witnesses, giving each the consistency proof from *its own* last-seen
   size, and assembles the cosignatures into a `WitnessedCheckpoint`.
   `auditSplitView` queries each witness's latest view and flags a fork when two
   witnesses hold the same size with different roots.
2. **Two transports.** `LocalWitnessTransport` wraps a `Witness` in-process (tests
   / single process); `HttpWitnessTransport` (`http-transport.ts`) talks to a
   witness service over HTTP with `connect()` discovery.
3. **Witness service (`apps/witness`).** A node:http service wrapping one witness
   with `/witness`, `/latest`, `/cosign`. Verified end-to-end over loopback,
   including a two-service split-view detection test.
4. **External anchoring (`anchor.ts`).** An `Anchor` interface plus a real local
   `FileAnchor` that appends signed checkpoint roots. Only the root is anchored —
   never content or identities. A blockchain / third-party-timestamp anchor is a
   matching implementation of the same interface and is deliberately not built.

## Consequences

- Fork/split-view is now detectable *in transit*: a log operator collects
  cosignatures, and an auditor comparing witness views catches a log that showed
  different heads.
- **Not yet solved (deployment):** a running multi-operator federation, witness
  discovery/registry, a continuous re-audit daemon, and on-chain anchoring.
  Detection still depends on witnesses/auditors actually being run and compared.
- Trust in witnesses and logs is configured via trust stores, not federated.
