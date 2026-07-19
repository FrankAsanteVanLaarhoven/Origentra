/**
 * Legal hold and SIEM export.
 *
 * Legal hold: while a target (asset/identity/incident) is under hold, it must not
 * be deleted or revoked — `assertNotHeld` fails closed. SIEM export: normalise
 * audit / transparency / exchange events to a common schema and a CEF-style line
 * for ingestion by a security-information-and-event-management system.
 */

export interface LegalHold {
  holdId: string;
  targets: string[];
  reason: string;
  placedBy: string;
  placedAt: string;
  releasedAt?: string;
}

export class LegalHoldRegistry {
  #holds = new Map<string, LegalHold>();
  #byTarget = new Map<string, Set<string>>();

  place(hold: LegalHold): void {
    this.#holds.set(hold.holdId, hold);
    for (const t of hold.targets) {
      const set = this.#byTarget.get(t) ?? new Set<string>();
      set.add(hold.holdId);
      this.#byTarget.set(t, set);
    }
  }

  release(holdId: string, releasedAt: string): void {
    const hold = this.#holds.get(holdId);
    if (!hold || hold.releasedAt) return;
    hold.releasedAt = releasedAt;
    for (const t of hold.targets) this.#byTarget.get(t)?.delete(holdId);
  }

  isHeld(target: string): boolean {
    return (this.#byTarget.get(target)?.size ?? 0) > 0;
  }

  holdsFor(target: string): LegalHold[] {
    return [...(this.#byTarget.get(target) ?? [])].map((id) => this.#holds.get(id)!).filter(Boolean);
  }

  /** Fail closed: throw if the target is under an active legal hold. */
  assertNotHeld(target: string): void {
    if (this.isHeld(target)) throw new Error(`legal_hold_active: ${target}`);
  }
}

// ---- SIEM export -----------------------------------------------------------

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface SiemEvent {
  ts: string;
  source: string;
  actor: string;
  action: string;
  target: string;
  outcome: 'success' | 'failure' | 'blocked';
  severity: Severity;
  detail?: Record<string, unknown>;
}

/** A generic audit-entry shape (matches @origentra/core AuditEntry). */
export interface AuditLike {
  at: string;
  actor: string;
  action: string;
  subject: string;
}

function severityFor(action: string): Severity {
  if (/revoke|block|suspend|compromise|forge|tamper/i.test(action)) return 'high';
  if (/approve|publish|delete/i.test(action)) return 'medium';
  return 'info';
}

export function auditToSiem(entries: AuditLike[], source = 'origentra'): SiemEvent[] {
  return entries.map((e) => ({
    ts: e.at,
    source,
    actor: e.actor,
    action: e.action,
    target: e.subject,
    outcome: 'success',
    severity: severityFor(e.action),
  }));
}

const CEF_SEV: Record<Severity, number> = { info: 1, low: 3, medium: 5, high: 8, critical: 10 };

/** ArcSight-style CEF line for SIEM ingestion. */
export function toCef(e: SiemEvent): string {
  const esc = (s: string) => s.replace(/([\\|])/g, '\\$1');
  const ext = [
    `rt=${e.ts}`,
    `suser=${esc(e.actor)}`,
    `act=${esc(e.action)}`,
    `outcome=${e.outcome}`,
    `target=${esc(e.target)}`,
  ].join(' ');
  return `CEF:0|Origentra|PassportOS|0.1|${esc(e.action)}|${esc(e.action)}|${CEF_SEV[e.severity]}|${ext}`;
}
