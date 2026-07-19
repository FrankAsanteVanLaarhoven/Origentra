# ADR 0010 — Biometric enrolment & consent gate

- Status: accepted
- Date: 2026-07-19

## Context

The DPIA and Article 9 analysis established that facial/voice detection processes
special-category biometric data and must be **privacy-by-design**: enrolment-gated,
consent-gated, hash-only, and reversible by the subject. This ADR implements the
*consenting-subject* side of that design in code.

## Decision

`@origentra/enrolment`:

1. **Granular, signed, withdrawable consent.** A subject signs an `EnrolmentConsent`
   naming specific modalities (face / voice / monitoring), a purpose, and the
   notice version shown. Consent for one modality never implies another. Minors
   are handled via a `guardianId`.
2. **Consent-gated references.** A reference biometric fingerprint (a perceptual
   hash — **never raw media**) is stored **CMK envelope-encrypted**. A detector can
   obtain it **only** while the subject's consent for that modality is active
   (`referenceFor` / `activeReferences` return nothing otherwise). This enforces
   enrolment-gating in code: a detector index built from `activeReferences` simply
   does not contain non-consenting or withdrawn subjects.
3. **Withdrawal → crypto-shred.** Withdrawal is a single signed statement,
   symmetric to consent, that must be signed by the same key that gave consent. It
   destroys the encrypted reference and its wrapped data key, leaving **no
   plaintext copy**, and blocks further use.
4. **Transparency-logged.** Consent, enrolment and withdrawal events are appended
   to a transparency log.

## Consequences

- The Phase-2 biometric detectors can be built to consume **only** consent-gated
  references, so the *consenting-subject* processing is lawful-by-design and a
  subject can revoke at any time with immediate crypto-shred.
- **This code does NOT by itself establish a lawful basis.** It implements
  consent + minimisation + reversibility; the **Article 9 condition for comparing
  against a *non-consenting* suspected impersonator** (substantial public interest
  + Appropriate Policy Document) remains a legal/DPO decision. See the private
  governance docs. The non-biometric detectors need none of this and can ship now.
- **Crypto-shred scope:** shredding deletes the ciphertext + wrapped DEK held in
  the registry. A deployment that keeps backups of the ciphertext must use a
  per-enrolment key whose destruction shreds even backed-up copies.
- Consent verification here is signature-based; a production system additionally
  binds the signing key to a verified subject identity and, for minors, verified
  guardian age-assurance.
