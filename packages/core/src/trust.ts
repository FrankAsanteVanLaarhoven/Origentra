/**
 * Trust store.
 *
 * A verifier only marks a signer as SIGNER_TRUSTED when its key id is present
 * here. Everything else verifies as SIGNER_UNKNOWN and, consequently,
 * VERIFICATION_INCOMPLETE — a valid signature from an unknown key proves
 * integrity, not authority.
 */

export class TrustStore {
  private readonly keys = new Map<string, string>();

  /** Trust a signer by (keyId -> publicKeyPem). */
  add(keyId: string, publicKeyPem: string): this {
    this.keys.set(keyId, publicKeyPem);
    return this;
  }

  has(keyId: string): boolean {
    return this.keys.has(keyId);
  }

  publicKey(keyId: string): string | undefined {
    return this.keys.get(keyId);
  }

  get size(): number {
    return this.keys.size;
  }
}
