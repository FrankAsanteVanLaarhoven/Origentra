/**
 * Ed25519 key management and detached signatures.
 *
 * Origentra signs manifests, identity claims and execution receipts with
 * Ed25519. Keys are handled as PEM for portability. A `keyId` is derived from
 * the public key so that a signer can be referenced compactly and looked up in
 * a trust store.
 *
 * This module never persists keys. Callers own storage; private key material
 * must never be logged or committed (see .gitignore and docs/THREAT-MODEL.md).
 */

import { createHash, generateKeyPairSync, sign as edSign, verify as edVerify, createPublicKey } from 'node:crypto';
import type { SignerRef } from './types.ts';

export interface KeyPair {
  keyId: string;
  publicKeyPem: string;
  privateKeyPem: string;
}

/** Derive a stable, compact key id from a public key PEM. */
export function keyIdFromPublicKey(publicKeyPem: string): string {
  // Hash the canonical DER of the SPKI so the id is independent of PEM whitespace.
  const der = createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });
  const h = createHash('sha256').update(der).digest();
  return 'key:' + h.subarray(0, 10).toString('hex');
}

export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  return { keyId: keyIdFromPublicKey(publicKeyPem), publicKeyPem, privateKeyPem };
}

export function signerRef(pair: KeyPair): SignerRef {
  return { keyId: pair.keyId, publicKeyPem: pair.publicKeyPem };
}

/** Sign raw bytes; returns a base64 signature. */
export function sign(privateKeyPem: string, bytes: Buffer): string {
  return edSign(null, bytes, privateKeyPem).toString('base64');
}

/** Verify a base64 signature over raw bytes. Never throws on bad input. */
export function verify(publicKeyPem: string, bytes: Buffer, signatureB64: string): boolean {
  try {
    return edVerify(null, bytes, publicKeyPem, Buffer.from(signatureB64, 'base64'));
  } catch {
    return false;
  }
}
