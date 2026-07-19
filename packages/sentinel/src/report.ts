/**
 * Signing and verification for abuse reports, appeals, adjudications and linkage
 * edges. Everything is signed so every assertion is attributable — the primary
 * defence against a weaponised flagging system.
 */

import {
  canonicalBytes,
  sign,
  verify as verifySig,
  signerRef,
  type KeyPair,
  type TrustStore,
} from '../../core/src/index.ts';
import type { AbuseReport, Appeal, Adjudication, LinkageEdge } from './types.ts';

function clampConfidence(c: number): number {
  if (!Number.isFinite(c) || c < 0 || c > 1) throw new RangeError('confidence must be in [0,1]');
  return c;
}

export function signReport(
  fields: Omit<AbuseReport, 'signer' | 'signature'>,
  key: KeyPair,
): AbuseReport {
  clampConfidence(fields.confidence);
  if (!fields.uncertainty.trim()) throw new Error('uncertainty statement is required');
  const body = { ...fields };
  return { ...body, signer: signerRef(key), signature: sign(key.privateKeyPem, canonicalBytes(body)) };
}

export function verifyReport(report: AbuseReport, reporterTrust: TrustStore): boolean {
  const { signer, signature, ...body } = report;
  return reporterTrust.has(signer.keyId) && verifySig(signer.publicKeyPem, canonicalBytes(body), signature);
}

export function signAppeal(fields: Omit<Appeal, 'signer' | 'signature'>, key: KeyPair): Appeal {
  const body = { ...fields };
  return { ...body, signer: signerRef(key), signature: sign(key.privateKeyPem, canonicalBytes(body)) };
}

/** Appeals are open (due process): a valid signature is enough, no trust gate. */
export function verifyAppeal(appeal: Appeal): boolean {
  const { signer, signature, ...body } = appeal;
  return verifySig(signer.publicKeyPem, canonicalBytes(body), signature);
}

export function signAdjudication(
  fields: Omit<Adjudication, 'signer' | 'signature'>,
  key: KeyPair,
): Adjudication {
  const body = { ...fields };
  return { ...body, signer: signerRef(key), signature: sign(key.privateKeyPem, canonicalBytes(body)) };
}

export function verifyAdjudication(adj: Adjudication, adjudicatorTrust: TrustStore): boolean {
  const { signer, signature, ...body } = adj;
  return adjudicatorTrust.has(signer.keyId) && verifySig(signer.publicKeyPem, canonicalBytes(body), signature);
}

export function signLinkage(
  fields: Omit<LinkageEdge, 'signer' | 'signature'>,
  key: KeyPair,
): LinkageEdge {
  clampConfidence(fields.confidence);
  const body = { ...fields };
  return { ...body, signer: signerRef(key), signature: sign(key.privateKeyPem, canonicalBytes(body)) };
}

export function verifyLinkage(edge: LinkageEdge, linkerTrust: TrustStore): boolean {
  const { signer, signature, ...body } = edge;
  return linkerTrust.has(signer.keyId) && verifySig(signer.publicKeyPem, canonicalBytes(body), signature);
}
