/**
 * Rights & consent evaluation.
 *
 * This module matches a set of rights ASSERTIONS against a REQUIREMENT for a
 * particular publication (platform, territory, advertising, derivative use). It
 * returns which required rights are satisfied and which are blocking.
 *
 * IMPORTANT (docs/CLAIMS.md): this does not determine legal ownership. It
 * evaluates the assertions and their status (present / expired / revoked /
 * disputed / scope-mismatch). A missing, expired, revoked or disputed
 * mandatory right is BLOCKING — publication must fail closed.
 */

import type { RightsRecord, RightKind } from './types.ts';

export interface RightsRequirement {
  /** Right kinds that must be present and valid to publish. */
  required: RightKind[];
  platform?: string;
  territory?: string;
  /** True if the publication is an advertisement. */
  advertising?: boolean;
  /** True if the publication is a derivative work. */
  derivative?: boolean;
}

export interface RightsIssue {
  kind: RightKind;
  reason:
    | 'missing'
    | 'expired'
    | 'revoked'
    | 'disputed'
    | 'platform_excluded'
    | 'territory_excluded'
    | 'advertising_not_permitted'
    | 'derivative_not_permitted';
}

export interface RightsEvaluation {
  satisfied: boolean;
  /** Blocking issues that must be resolved before publication. */
  blocking: RightsIssue[];
}

function applicable(r: RightsRecord, req: RightsRequirement, now: string): RightsIssue['reason'] | null {
  if (r.revokedAt && r.revokedAt <= now) return 'revoked';
  if (r.expiresAt && r.expiresAt <= now) return 'expired';
  if (r.disputed) return 'disputed';
  if (req.platform && r.platforms && r.platforms.length > 0 && !r.platforms.includes(req.platform)) {
    return 'platform_excluded';
  }
  if (
    req.territory &&
    r.territories &&
    r.territories.length > 0 &&
    !r.territories.includes(req.territory)
  ) {
    return 'territory_excluded';
  }
  if (req.advertising && r.advertisingPermitted === false) return 'advertising_not_permitted';
  if (req.derivative && r.derivativePermitted === false) return 'derivative_not_permitted';
  return null;
}

export function evaluateRights(
  rights: RightsRecord[],
  req: RightsRequirement,
  now: string,
): RightsEvaluation {
  const blocking: RightsIssue[] = [];

  for (const kind of req.required) {
    const candidates = rights.filter((r) => r.kind === kind);
    if (candidates.length === 0) {
      blocking.push({ kind, reason: 'missing' });
      continue;
    }
    // A right is satisfied if at least one asserted record is valid for this use.
    let satisfiedBy: RightsIssue['reason'] | null | 'ok' = null;
    for (const c of candidates) {
      const issue = applicable(c, req, now);
      if (issue === null) {
        satisfiedBy = 'ok';
        break;
      }
      satisfiedBy = issue;
    }
    if (satisfiedBy !== 'ok') {
      blocking.push({ kind, reason: satisfiedBy ?? 'missing' });
    }
  }

  return { satisfied: blocking.length === 0, blocking };
}
