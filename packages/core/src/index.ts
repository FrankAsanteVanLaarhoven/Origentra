/**
 * @origentra/core — reference implementation of the Origentra Passport OS
 * trust primitives. Zero runtime dependencies; Node >= 22.6.
 *
 * This package is the open reference signer + verifier + policy engine. It is
 * deliberately transport- and storage-agnostic.
 */

export * from './types.ts';
export * from './canonical.ts';
export * from './digest.ts';
export * from './keys.ts';
export * from './trust.ts';
export * from './fingerprint.ts';
export * from './identity.ts';
export * from './passport.ts';
export * from './store.ts';
export * from './rights.ts';
export * from './policy.ts';
export * from './execution.ts';
export * from './audit.ts';
export * from './evidence.ts';
