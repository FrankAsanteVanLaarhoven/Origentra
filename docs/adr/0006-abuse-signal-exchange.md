# ADR 0006 — Abuse-signal exchange: recommend-only, accountable, appealable

- Status: accepted
- Date: 2026-07-19

## Context

A cross-platform system for tracking malicious / fake / harassing accounts is the
single most powerful *and* most dangerous capability in the Origentra vision.
Mechanically, a system that flags accounts to other platforms is the same system
whether it stops genuine abusers or destroys innocent people — the difference is
entirely the guardrails. Shared blocklists without due process have caused real
harm: false positives, ban-evasion arms races, defamation, GDPR Article 22
violations (the right not to be subject to solely-automated decisions), and —
most importantly — weaponisation, where the flagging system itself becomes the
abuse tool via coordinated false reporting.

## Decision

Build an **abuse-signal exchange that shares accountable EVIDENCE, never an
enforcement verdict.** Guardrails are structural, not advisory:

1. **Recommend-only.** There is no `ban`/`block`/`action`/`verdict` field anywhere
   in the types. `signals()` returns evidence, corroboration and confidence plus a
   permanent disclaimer; the consuming platform decides and is accountable. A
   benchmark KPI structurally asserts no verdict field is ever emitted.
2. **Reporter accountability.** Every report, appeal, adjudication and linkage edge
   is signed. Reports are admitted only from trusted reporters; a bad-faith
   reporter is attributable.
3. **Quorum.** A signal is `corroborated` only with a quorum of *distinct* trusted
   reporters. One reporter — or one reporter filing many reports — is
   `single_source`, never corroborated.
4. **Due process.** A target can `appeal` (open — a valid signature is enough, no
   trust gate). A pending appeal marks the signal `contested`. A trusted
   adjudicator can `overturn`, which removes the report from the active signal.
5. **Transparency-logged.** Every report/appeal/adjudication is appended to a
   transparency log (append-only, provable), so the flagging process is itself
   auditable and cannot be quietly rewritten.
6. **Uncertainty is mandatory.** Reports must carry a confidence in [0,1] and a
   non-empty uncertainty statement; the safe default is insufficient evidence.
7. **Linkage is probabilistic evidence, not identity.** Sock-puppet clusters
   follow signed, confidence-scored edges; low-confidence edges are excluded from
   clustering and exist for human review only. Origentra never claims two accounts
   are conclusively the same person.

## Consequences

- The system is defensible: evidence-sharing with accountability, quorum, appeal
  and consumer-side decisioning, aligned with "evidence, not conclusions" and
  GDPR's stance on automated decisions.
- **Explicitly out of scope / not solved:** Origentra ships no abuse *detectors*
  (reports come from external detection or human review); there is no
  reporter-reputation weighting yet (a colluding quorum of trusted reporters is
  bounded only by the quorum, not by reputation); false positives are expected and
  detection is never certain; and PII minimisation is the caller's responsibility.
  See `docs/LIMITATIONS.md` and `docs/CLAIMS.md`.
- Origentra deliberately does NOT provide automated cross-platform blocking. That
  posture was considered and rejected as the harassment/defamation/censorship
  failure mode.
