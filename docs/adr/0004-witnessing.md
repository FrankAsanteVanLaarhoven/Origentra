# ADR 0004 — Distributed witnessing and durable log persistence

- Status: accepted
- Date: 2026-07-19

## Context

ADR-0003 left one gap open: a transparency-log operator can still fork the log
and present different (self-consistent) heads to different clients — a "split
view" that inclusion/consistency proofs against a single head cannot catch. The
log was also in-memory, so it did not survive a restart.

## Decision

1. **Witness cosigning (`witness.ts`).** An independent witness co-signs a
   checkpoint only after verifying it is an append-only successor of the last
   checkpoint that witness saw — via a consistency proof. It refuses rollbacks
   (smaller size), same-size forks (different root), and larger forks whose
   consistency proof does not chain from its last-seen root. A forked head
   therefore cannot gather cosignatures.
2. **Quorum verification.** `verifyWitnessed` accepts a checkpoint only if it is
   signed by a trusted log key AND co-signed by at least K distinct *trusted*
   witnesses. Untrusted cosignatures do not count.
3. **Direct split-view detection.** `detectSplitView` flags two validly-signed
   checkpoints of the same log and size with different roots as proof of a fork.
4. **Durable log.** `TransparencyLog` can be file-backed: leaf hashes are
   appended (one hex line each) and reloaded on construction, so the log — and
   all its proofs — survive a restart. Only leaf hashes are stored; proofs need
   nothing more.

This is the witness model used by Certificate Transparency and the Go checksum
database.

## Consequences

- A fork or rollback is refused by honest witnesses and a split view is
  detectable, closing the ADR-0003 gap at the primitive level.
- **Not yet solved:** a live gossip *transport* that automatically distributes
  checkpoints and cosignatures between witnesses and clients — without it, a fork
  is caught only when parties actually compare cosigned checkpoints. External
  (blockchain) anchoring of roots and a hardened database (PostgreSQL RLS) also
  remain future work; the file-backed log enforces durability but not at
  database scale.
