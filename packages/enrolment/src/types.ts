/**
 * Biometric enrolment & consent types.
 *
 * This implements the privacy-by-design gate from the Article 9 design: a
 * protected subject may ENROL their face/voice reference for impersonation
 * protection ONLY under explicit, granular, withdrawable consent. Consent and
 * withdrawal are signed by the subject (or a guardian for minors). Withdrawal is
 * a single signed statement — as easy to give as consent — and triggers a
 * crypto-shred of the encrypted reference.
 */

import type { SignerRef } from '../../core/src/index.ts';

/** Granular consent scopes — face, voice and the monitoring itself are separate. */
export type ConsentModality = 'face' | 'voice' | 'monitoring';

export interface EnrolmentConsent {
  subjectId: string;
  /** The modalities the subject explicitly consents to. */
  modalities: ConsentModality[];
  purpose: string;
  /** Version of the privacy notice/consent text shown at capture. */
  noticeVersion: string;
  consentedAt: string;
  expiresAt?: string;
  /** Present when the subject is a minor and a guardian consented. */
  guardianId?: string;
  signer: SignerRef;
  signature: string;
}

export interface ConsentWithdrawal {
  subjectId: string;
  modalities: ConsentModality[];
  withdrawnAt: string;
  signer: SignerRef;
  signature: string;
}

export type EnrolmentStatus = 'active' | 'withdrawn';
