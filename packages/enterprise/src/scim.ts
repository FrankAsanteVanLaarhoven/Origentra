/**
 * SCIM 2.0 provisioning (RFC 7643/7644 subset).
 *
 * Bridges an enterprise IdP's user lifecycle to Origentra identities: creating a
 * SCIM user ISSUES a signed identity (scopes from roles via a role→scope map);
 * deactivating or deleting a user DEPROVISIONS it (revokes the identity). This is
 * the automated joiner/mover/leaver control enterprises require.
 */

import {
  issueIdentity,
  revokeIdentity,
  type SignedIdentityClaim,
  type KeyPair,
} from '../../core/src/index.ts';

const USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';

export interface ScimName {
  givenName?: string;
  familyName?: string;
  formatted?: string;
}
export interface ScimEmail {
  value: string;
  primary?: boolean;
}
export interface ScimUser {
  schemas: string[];
  id: string;
  userName: string;
  active: boolean;
  name?: ScimName;
  emails?: ScimEmail[];
  roles?: string[];
  meta: { resourceType: 'User'; created: string; lastModified: string };
}
export interface ScimCreateInput {
  userName: string;
  active?: boolean;
  name?: ScimName;
  emails?: ScimEmail[];
  roles?: string[];
}

export interface ScimProvisionerOptions {
  tenantId: string;
  roleScopeMap: Record<string, string[]>;
  now: () => string;
}

export class ScimProvisioner {
  #issuerKey: KeyPair;
  #tenantId: string;
  #roleScopeMap: Record<string, string[]>;
  #now: () => string;
  #users = new Map<string, ScimUser>();
  #byUserName = new Map<string, string>();
  #identities = new Map<string, SignedIdentityClaim>();
  #counter = 0;

  constructor(issuerKey: KeyPair, opts: ScimProvisionerOptions) {
    this.#issuerKey = issuerKey;
    this.#tenantId = opts.tenantId;
    this.#roleScopeMap = opts.roleScopeMap;
    this.#now = opts.now;
  }

  #reprovision(user: ScimUser): void {
    if (user.active) {
      const scopes = new Set<string>();
      for (const r of user.roles ?? []) for (const s of this.#roleScopeMap[r] ?? []) scopes.add(s);
      this.#identities.set(
        user.id,
        issueIdentity(
          {
            identityId: `scim:${user.userName}`,
            tenantId: this.#tenantId,
            subjectType: 'person',
            displayName: user.name?.formatted ?? user.userName,
            scopes: [...scopes],
            issuedAt: this.#now(),
          },
          this.#issuerKey,
        ),
      );
    } else {
      const prev = this.#identities.get(user.id);
      if (prev && !prev.claim.revocation) {
        this.#identities.set(user.id, revokeIdentity(prev, this.#now(), 'deprovisioned', this.#issuerKey));
      }
    }
  }

  create(input: ScimCreateInput): ScimUser {
    if (this.#byUserName.has(input.userName)) throw new Error('conflict: userName exists');
    const id = `scim-user-${++this.#counter}`;
    const ts = this.#now();
    const user: ScimUser = {
      schemas: [USER_SCHEMA],
      id,
      userName: input.userName,
      active: input.active ?? true,
      ...(input.name ? { name: input.name } : {}),
      ...(input.emails ? { emails: input.emails } : {}),
      roles: input.roles ?? [],
      meta: { resourceType: 'User', created: ts, lastModified: ts },
    };
    this.#users.set(id, user);
    this.#byUserName.set(input.userName, id);
    this.#reprovision(user);
    return user;
  }

  get(id: string): ScimUser | undefined {
    return this.#users.get(id);
  }
  list(): ScimUser[] {
    return [...this.#users.values()];
  }

  setActive(id: string, active: boolean): ScimUser {
    const user = this.#users.get(id);
    if (!user) throw new Error('not_found');
    user.active = active;
    user.meta.lastModified = this.#now();
    this.#reprovision(user);
    return user;
  }

  replaceRoles(id: string, roles: string[]): ScimUser {
    const user = this.#users.get(id);
    if (!user) throw new Error('not_found');
    user.roles = roles;
    user.meta.lastModified = this.#now();
    this.#reprovision(user);
    return user;
  }

  /** SCIM DELETE = deprovision: revoke the identity and remove the user record. */
  delete(id: string): void {
    const user = this.#users.get(id);
    if (!user) return;
    user.active = false;
    this.#reprovision(user);
    this.#users.delete(id);
    this.#byUserName.delete(user.userName);
  }

  identityFor(id: string): SignedIdentityClaim | undefined {
    return this.#identities.get(id);
  }
}
