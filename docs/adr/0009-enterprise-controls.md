# ADR 0009 — Enterprise controls

- Status: accepted
- Date: 2026-07-19

## Context

Enterprise buyers require SSO, automated provisioning, customer-managed
encryption keys, legal hold and SIEM integration. These must fit the existing
identity/trust model and stay zero-dependency, and the milestone must be honest
about what genuinely needs external infrastructure.

## Decision

Build `@origentra/enterprise` with the controls that are fully implementable and
testable in-repo:

1. **Customer-managed keys (`cmk.ts`)** — AES-256-GCM envelope encryption: a
   per-object DEK encrypts data; a customer-held root key wraps the DEK via a
   `KeyProvider`. `LocalKeyProvider` is the reference customer-KMS boundary.
   Rotation re-wraps DEKs without re-encrypting data; any tampering fails closed
   (GCM). An external KMS (AWS/GCP/HSM) is a matching `KeyProvider`, not built.
2. **SSO via OIDC/JWT (`sso.ts`)** — verify ID tokens against a JWKS with
   issuer/audience/expiry/kid checks (EdDSA + RS256); map verified claims to a
   scoped Origentra identity via an explicit role→scope map (least privilege).
   XML-based **SAML (XML-DSig) is NOT implemented** — OIDC is the modern path.
3. **SCIM 2.0 provisioning (`scim.ts` + `apps/scim`)** — creating a user issues a
   signed identity; deactivating/deleting DEPROVISIONS (revokes) it. Bearer-token
   HTTP endpoint (RFC 7644 subset).
4. **Legal hold + SIEM export (`governance.ts`)** — a hold registry that fails
   closed on deletion/revocation of held targets, and normalisation of audit
   events to a common schema + CEF line.

## Consequences

- SSO, provisioning, BYOK encryption, legal hold and SIEM export are real and
  benchmarked (CMK integrity, SSO validation hard gates).
- **Deferred / not built (documented):** SAML XML-DSig; a hardened PostgreSQL
  store with row-level security (the reference stores are file-backed but enforce
  the same tenant-isolation contract); external KMS/HSM integration; and real
  container/codec decoding for the AV detectors. Legal hold and SIEM export are
  libraries — wiring them into every deletion path and event source across the
  platform is integration work beyond this milestone.
