# Threat model (Milestone 1)

Scope: the trust core in `packages/core`. Network, storage, UI and platform
integrations are out of scope here and carry their own threat models when built.

## Assets to protect

- **Signing keys** (tenant authority, execution keys). Compromise forges
  passports, identities, approvals or receipts.
- **Integrity of decisions**: a `BLOCK` must never become an execution.
- **Tenant isolation**: one tenant must never act on another's assets.
- **Audit integrity**: history must be tamper-evident.

## Trust boundaries

1. **Signer → verifier.** The verifier trusts only key ids present in its trust
   store. A valid signature from an unknown key is `SIGNER_UNKNOWN` +
   `VERIFICATION_INCOMPLETE` — integrity without authority.
2. **Proposer → policy engine.** The proposer (including an AI agent) is
   untrusted. The engine re-verifies every input and decides deterministically.
3. **Policy decision → execution.** Execution consumes a decision + approvals and
   independently re-checks authorisation; it never trusts a "please publish" flag.

## Threats & mitigations

| # | Threat | Mitigation | Evidence |
| --- | --- | --- | --- |
| T1 | Forged/edited passport manifest | Ed25519 signature over canonical manifest; edit ⇒ `SIGNATURE_INVALID` | `test/passport.test.ts` |
| T2 | Untrusted signer masquerading as authority | Trust store gate; unknown ⇒ incomplete | `test/policy.test.ts` |
| T3 | Cross-tenant asset use | Tenant match on identity + passport; mismatch ⇒ `BLOCK` | `test/policy.test.ts` |
| T4 | Publishing without rights | Fail-closed rights evaluation (missing/expired/revoked/disputed) | `test/policy.test.ts`, `test/rights.test.ts` |
| T5 | AI agent self-publishing high-risk content | Agent principal ⇒ `REQUIRE_APPROVAL`; agent can never approve | `test/policy.test.ts`, `test/execution.test.ts` |
| T6 | Approval replay against a different decision | Approvals bound to `decisionDigest`; stale ⇒ rejected | `test/execution.test.ts` |
| T7 | Duplicate execution / double-post | Idempotency key ⇒ one receipt, one side effect | `test/execution.test.ts` |
| T8 | Executing a blocked decision | `authorize()` refuses `BLOCK`; adapter records `blocked` | `test/execution.test.ts` |
| T9 | Silent tampering of history | Append-only hash chain; edit/re-order ⇒ chain breaks | `test/audit.test.ts` |
| T10 | Non-deterministic decisions (audit ambiguity) | Engine calls no model; identical inputs ⇒ identical digest | `test/policy.test.ts` |
| T11 | Undisclosed/unknown-origin AI content | Disclosure required for synthetic media; unknown ⇒ `BLOCK` | `test/policy.test.ts` |

## Residual risks (not mitigated in Milestone 1)

- **Key compromise / rotation.** No HSM/KMS integration and no rotation protocol.
  A stolen private key forges artefacts until its key id is removed from every
  trust store. (Revocation *distribution* is addressed by
  `@origentra/transparency`: a trusted, log-recorded revocation makes a verifier
  emit `CREDENTIAL_REVOKED`.)
- **Log fork / split view.** Detectable but not yet prevented in transit. Witness
  cosigning refuses non-append-only heads and split views are directly
  detectable (`detectSplitView`), but there is no live gossip network wiring
  witnesses and clients together, so a fork is caught only when parties actually
  compare cosigned checkpoints. External anchoring is also not implemented.
- **Provenance stripping / re-encoding.** See `LIMITATIONS.md` — perceptual
  hashing is not yet implemented, so re-encoded media evades fuzzy recovery.
- **Durability.** In-memory stores; no persistence, replication or backup.
- **Denial of service / resource limits.** No input-size bounds on fingerprinting
  or canonicalisation yet.
- **Confused-deputy via the issuer key.** The demo uses one authority key for
  identities, passports and approvals; production must separate these roles and
  scope keys per purpose.

These are tracked as the entry criteria for later milestones, not hidden.
