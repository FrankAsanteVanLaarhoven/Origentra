/**
 * Customer-managed keys (CMK) — envelope encryption.
 *
 * Data is encrypted with a per-object data encryption key (DEK) using
 * AES-256-GCM; the DEK is then wrapped by a customer-held root key via a
 * KeyProvider (the customer's KMS boundary). The service never persists the raw
 * DEK or the root key — only the ciphertext and the wrapped DEK. Rotating the
 * root key re-wraps DEKs without re-encrypting the data. GCM authentication means
 * any tampering (ciphertext, IV, tag, or wrapped DEK) fails closed on decrypt.
 *
 * `LocalKeyProvider` represents the customer's KMS holding the root key. A real
 * external KMS (AWS KMS, GCP KMS, HSM) is a matching implementation of the same
 * `KeyProvider` interface — not built here.
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const b64 = (b: Buffer) => b.toString('base64');
const unb64 = (s: string) => Buffer.from(s, 'base64');

export interface WrappedKey {
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  ciphertext: string;
}

export interface KeyProvider {
  readonly keyId: string;
  wrap(dek: Buffer): WrappedKey;
  unwrap(wrapped: WrappedKey): Buffer;
}

/** A local root key holder — the reference stand-in for a customer KMS. */
export class LocalKeyProvider implements KeyProvider {
  #root: Buffer;
  readonly keyId: string;

  constructor(rootKey: Buffer, keyId = 'cmk-local/1') {
    if (rootKey.length !== 32) throw new RangeError('root key must be 32 bytes (AES-256)');
    this.#root = rootKey;
    this.keyId = keyId;
  }

  static generate(keyId?: string): LocalKeyProvider {
    return new LocalKeyProvider(randomBytes(32), keyId);
  }

  wrap(dek: Buffer): WrappedKey {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.#root, iv);
    const ct = Buffer.concat([c.update(dek), c.final()]);
    return { alg: 'aes-256-gcm', iv: b64(iv), tag: b64(c.getAuthTag()), ciphertext: b64(ct) };
  }

  unwrap(w: WrappedKey): Buffer {
    const d = createDecipheriv('aes-256-gcm', this.#root, unb64(w.iv));
    d.setAuthTag(unb64(w.tag));
    return Buffer.concat([d.update(unb64(w.ciphertext)), d.final()]);
  }
}

export interface Envelope {
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  ciphertext: string;
  wrappedDek: WrappedKey;
  keyId: string;
}

export function encrypt(plaintext: Buffer | string, provider: KeyProvider): Envelope {
  const dek = randomBytes(32);
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', dek, iv);
  const pt = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
  const ct = Buffer.concat([c.update(pt), c.final()]);
  return {
    alg: 'aes-256-gcm',
    iv: b64(iv),
    tag: b64(c.getAuthTag()),
    ciphertext: b64(ct),
    wrappedDek: provider.wrap(dek),
    keyId: provider.keyId,
  };
}

export function decrypt(env: Envelope, provider: KeyProvider): Buffer {
  const dek = provider.unwrap(env.wrappedDek);
  const d = createDecipheriv('aes-256-gcm', dek, unb64(env.iv));
  d.setAuthTag(unb64(env.tag));
  return Buffer.concat([d.update(unb64(env.ciphertext)), d.final()]);
}

/** Rotate the root key: re-wrap the DEK under a new provider; ciphertext untouched. */
export function rewrap(env: Envelope, oldProvider: KeyProvider, newProvider: KeyProvider): Envelope {
  const dek = oldProvider.unwrap(env.wrappedDek);
  return { ...env, wrappedDek: newProvider.wrap(dek), keyId: newProvider.keyId };
}
