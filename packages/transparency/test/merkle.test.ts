import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leafHash,
  merkleRoot,
  inclusionProof,
  verifyInclusion,
  consistencyProof,
  verifyConsistency,
} from '../src/index.ts';

const MAX = 20;
function leaves(n: number): Buffer[] {
  return Array.from({ length: n }, (_, i) => leafHash(`entry-${i}`));
}

test('inclusion proofs verify for every leaf of every tree size 1..MAX', () => {
  for (let n = 1; n <= MAX; n++) {
    const ls = leaves(n);
    const root = merkleRoot(ls);
    for (let i = 0; i < n; i++) {
      const proof = inclusionProof(i, ls);
      assert.ok(verifyInclusion(ls[i]!, i, n, proof, root), `inclusion n=${n} i=${i}`);
    }
  }
});

test('inclusion verification rejects a tampered root and wrong leaf', () => {
  const ls = leaves(11);
  const root = merkleRoot(ls);
  const proof = inclusionProof(5, ls);
  assert.equal(verifyInclusion(ls[5]!, 5, 11, proof, leafHash('not-the-root')), false);
  assert.equal(verifyInclusion(leafHash('wrong-leaf'), 5, 11, proof, root), false);
  assert.equal(verifyInclusion(ls[5]!, 6, 11, proof, root), false); // wrong index
});

test('consistency proofs verify for every 0 <= m <= n <= MAX (append-only)', () => {
  for (let n = 1; n <= MAX; n++) {
    const ls = leaves(n);
    const newRoot = merkleRoot(ls);
    for (let m = 0; m <= n; m++) {
      const oldRoot = merkleRoot(ls.slice(0, m));
      const proof = consistencyProof(m, ls);
      assert.ok(
        verifyConsistency(m, oldRoot, n, newRoot, proof),
        `consistency m=${m} n=${n}`,
      );
    }
  }
});

test('consistency verification catches a rewritten history', () => {
  const ls = leaves(12);
  const oldRoot = merkleRoot(ls.slice(0, 7));
  const newRoot = merkleRoot(ls);
  const proof = consistencyProof(7, ls);
  assert.ok(verifyConsistency(7, oldRoot, 12, newRoot, proof));

  // Rewrite an old entry, keep the same size: the old prefix root no longer matches.
  const rewritten = [...ls];
  rewritten[3] = leafHash('tampered-history');
  const rewrittenNewRoot = merkleRoot(rewritten);
  const rewrittenProof = consistencyProof(7, rewritten);
  const originalOldRoot = merkleRoot(ls.slice(0, 7));
  assert.equal(
    verifyConsistency(7, originalOldRoot, 12, rewrittenNewRoot, rewrittenProof),
    false,
    'a log that rewrote entry 3 must fail consistency against the original checkpoint',
  );
});

test('consistency verification rejects a tampered new root', () => {
  const ls = leaves(9);
  const oldRoot = merkleRoot(ls.slice(0, 4));
  const proof = consistencyProof(4, ls);
  assert.equal(verifyConsistency(4, oldRoot, 9, leafHash('fake'), proof), false);
});
