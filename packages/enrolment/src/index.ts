/**
 * @origentra/enrolment — biometric enrolment & consent gate. Zero runtime
 * dependencies. Implements the Article 9 privacy-by-design controls: granular
 * signed consent, consent-gated detection references (CMK-encrypted, hash-only),
 * and withdrawal → crypto-shred, all transparency-logged.
 */

export * from './types.ts';
export * from './consent.ts';
export * from './registry.ts';
