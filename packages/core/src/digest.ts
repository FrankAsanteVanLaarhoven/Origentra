/**
 * Content digests.
 *
 * A digest is the exact cryptographic hash of an asset's bytes, formatted as
 * a self-describing `sha256:<hex>` string. Exact digests are precise but
 * fragile: any transformation changes them. Survivability across
 * transformations is provided separately by fingerprint.ts.
 */

import { createHash } from 'node:crypto';
import { canonicalBytes } from './canonical.ts';
import type { Digest } from './types.ts';

export function sha256(bytes: Buffer | Uint8Array | string): Digest {
  const buf = typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : Buffer.from(bytes);
  return 'sha256:' + createHash('sha256').update(buf).digest('hex');
}

/** Digest of the canonical form of a JSON value (used by the audit log). */
export function digestObject(value: unknown): Digest {
  return 'sha256:' + createHash('sha256').update(canonicalBytes(value)).digest('hex');
}

/** Constant-time-ish equality for digest strings. */
export function digestEqual(a: Digest, b: Digest): boolean {
  return a.length === b.length && a === b;
}
