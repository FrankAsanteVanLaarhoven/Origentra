# SocialTrust-Bench v0.1

An open, reproducible benchmark for the Origentra trust core. Every KPI maps to
a specific failure mode. The harness is deterministic (no randomness, fixed
logical timestamps), so a re-run reproduces the numbers.

```bash
node bench/socialtrust-bench.ts        # prints a table; writes bench/reports/*.json
```

Hard-gate KPIs cause a non-zero exit, so the harness doubles as a CI gate.

## Honesty caveat (read this first)

These numbers are **self-measured on a self-defined corpus**. That makes
SocialTrust-Bench a **reproducibility and regression tool**, not a claim of
third-party-audited security. A vendor topping its own benchmark proves
regression discipline, not trustworthiness. Independent replication on an
external corpus is the goal; until then, treat every number as "reproducible on
this harness", nothing more.

## KPIs → failure modes

| KPI | Failure mode | Target | Gate |
| --- | --- | --- | --- |
| Passport validity rate | invalid/unverifiable passport | ≥99.9% | hard |
| Provenance survivability (text, registered) | origin lost after localized edit | ≥95% | soft |
| Provenance survivability (text, stress) | origin lost after global rewrite | informational | — |
| Provenance survivability (image) | image origin lost after transformation | ≥95% | soft |
| Provenance generation latency | passport generation too slow | <5000 ms | soft |
| Rights false-negative rate | restricted content approved | ≤0.5% | hard |
| Rights false-positive rate | legitimate content blocked | ≤2% | soft |
| Unauthorised-publication prevention | unapproved content published | 100% | hard |
| Agent approval-bypass rate | agent circumvents human approval | 0 / 10,000 | hard |
| Publishing reliability | publish fails/duplicates | ≥99.5% | soft |
| Cross-tenant isolation failures | tenant reads another's data | 0 | hard |
| Evidence completeness | incident packet incomplete | ≥99% | soft |
| Decision determinism | non-deterministic authorisation | 100% | hard |

## What the registered/stress split means

The text survivability KPI is split deliberately:

- **Registered** transforms (exact, append, prepend, small edit, tail truncation)
  are *localized* — what content-defined-chunking fingerprinting is designed to
  survive. This is the gated number.
- **Stress** transforms (double-every-space, uppercase-everything) are *global
  rewrites* that change essentially every byte. CDC is documented not to survive
  these (see `LIMITATIONS.md`); a perceptual/normalizing text fingerprint is the
  production path and is not yet implemented. These are reported transparently
  (typically ~0%) and are **not** gated — hiding them would be dishonest;
  mislabeling them as "registered" would be gaming the benchmark.

## Provenance found by the harness

The agent approval-bypass KPI caught a real defect during development: approvals
were validated for scope, trust and signature but **not tenant**, so a valid
approver from another tenant could authorise a publication. The fix binds
`PolicyDecision` to its tenant and rejects any approver whose identity is in a
different tenant (`approver_wrong_tenant`). This is exactly the class of failure
the benchmark exists to surface. The failure is documented here, not deleted.
