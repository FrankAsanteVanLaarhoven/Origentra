/**
 * Deterministic (canonical) JSON serialisation.
 *
 * Signing and audit-chaining require that the same logical object always
 * produces the same bytes. We use a JCS-style canonicalisation: object keys
 * are emitted in sorted (UTF-16 code-unit) order, there is no insignificant
 * whitespace, and `undefined` object properties are omitted.
 *
 * Constraints (documented in docs/LIMITATIONS.md): values must be JSON-safe.
 * We reject `NaN`, `Infinity` and non-integer-unsafe numbers so that a
 * signature can never depend on a platform-specific float rendering.
 */

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

export function canonicalize(value: unknown): string {
  return encode(value);
}

/** Canonical UTF-8 bytes, ready to be hashed or signed. */
export function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(canonicalize(value), 'utf8');
}

function encode(value: unknown): string {
  if (value === null) return 'null';

  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'string') return JSON.stringify(value);
  if (t === 'number') {
    const n = value as number;
    if (!Number.isFinite(n)) {
      throw new TypeError('canonicalize: non-finite numbers are not permitted');
    }
    // JSON.stringify gives the shortest round-trippable form for finite numbers.
    return JSON.stringify(n);
  }
  if (t === 'bigint') {
    throw new TypeError('canonicalize: bigint is not JSON-safe');
  }
  if (Array.isArray(value)) {
    return '[' + value.map((v) => encode(v === undefined ? null : v)).join(',') + ']';
  }
  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    const parts = keys.map((k) => JSON.stringify(k) + ':' + encode(obj[k]));
    return '{' + parts.join(',') + '}';
  }
  throw new TypeError(`canonicalize: unsupported value of type ${t}`);
}
