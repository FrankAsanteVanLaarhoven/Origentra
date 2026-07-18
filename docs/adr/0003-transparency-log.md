# ADR 0003 — Verifiable transparency log and revocation distribution

- Status: accepted
- Date: 2026-07-19

## Context

The core audit log (`audit.ts`) is tamper-evident only within one instance: it
cannot prove to a third party that history was never rewritten, and it offers no
way to learn that a credential was revoked after issuance. Both are core trust
gaps — the threat model listed "no revocation distribution" as a residual risk,
and a trust platform whose verifiers can't detect revocation or log-tampering is
incomplete.

## Decision

1. **Add a Merkle transparency log (`@origentra/transparency`)** following the
   RFC 6962 hashing scheme: leaf = SHA-256(0x00‖data), node = SHA-256(0x01‖l‖r).
   It issues **signed checkpoints** (size + root), **inclusion proofs** (an entry
   is in the log) and **consistency proofs** (a newer checkpoint is an
   append-only extension of an older one).
2. **Generation and verification are the matched recursive pair.** Proof
   generation uses the RFC 6962 recursive definitions; verification is the exact
   recursive inverse (not the RFC 9162 iterative variant, whose consistency-proof
   lengths differ). Correctness is validated **exhaustively** in tests for every
   inclusion index and every consistency pair up to a bound.
3. **Revocations are transparency-logged and trust-gated.** A revocation is a
   signed statement honoured only when signed by a trusted key, and every accepted
   revocation is appended to the log — so revocations are themselves append-only
   and provable. The public verifier consults the registry and emits
   `CREDENTIAL_REVOKED`, so a passport can be revoked after issuance and every
   verifier learns, even when the presented passport object is unmarked.
4. **Core stays minimal.** `verifyPassport` gains one optional hook,
   `isRevoked(passport)`, so the revocation source is injected by the verifier;
   core takes no dependency on the transparency package.

## Consequences

- Append-only-ness is now provable between any two checkpoints, and revocation
  propagates to verifiers — closing two trust gaps.
- **Not yet solved:** a distributed witness/gossip layer. A malicious operator
  could fork the log and show different self-consistent heads to different
  clients; detecting that needs third-party witnesses, which is future work.
  Optional external anchoring of checkpoint roots is also not implemented.
- Both logs remain in-memory; durable storage is a later milestone.
