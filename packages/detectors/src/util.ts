/**
 * String primitives for handle/domain impersonation detection.
 *
 * `skeleton` folds a string to a confusable-normalised, lower-case form so that
 * look-alikes ("paypa1", "pаypal" with a Cyrillic а) collapse together. The
 * confusables map is a curated, deliberately-partial subset of the Unicode
 * confusables — it catches common homoglyph/typosquat tricks, not every possible
 * substitution (see docs/LIMITATIONS.md).
 */

const CONFUSABLES: Record<string, string> = {
  // digit / symbol look-alikes
  '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b',
  $: 's', '@': 'a', '|': 'l', '!': 'i',
  // Cyrillic look-alikes
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', к: 'k', м: 'm', т: 't', н: 'h', в: 'b', і: 'i', ѕ: 's',
  // Greek look-alikes
  ο: 'o', α: 'a', ρ: 'p', ν: 'v', ε: 'e', κ: 'k', τ: 't',
};

export function skeleton(s: string): string {
  const folded = [...s.toLowerCase()].map((ch) => CONFUSABLES[ch] ?? ch).join('');
  // 'rn' visually reads as 'm'; fold after char substitution.
  return folded.replace(/rn/g, 'm');
}

/** Levenshtein edit distance. */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}

/** Similarity in [0,1] based on edit distance over the longer length. */
export function stringSimilarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - editDistance(a, b) / max;
}
