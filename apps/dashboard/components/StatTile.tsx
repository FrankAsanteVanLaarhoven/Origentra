const TONE = { neon: "var(--neon)", ok: "var(--ok)", warn: "var(--warn)", bad: "var(--bad)" } as const;

export function StatTile({
  label,
  value,
  unit,
  delta,
  tone = "neon",
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  tone?: keyof typeof TONE;
}) {
  const color = TONE[tone];
  return (
    <div className="panel rise p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--muted)" }}>{label}</span>
        <span className="dot" style={{ color }} />
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="stat-value text-3xl" style={{ color: "var(--text)" }}>{value}</span>
        {unit && <span className="mono text-sm" style={{ color: "var(--muted)" }}>{unit}</span>}
      </div>
      {delta && <div className="mono mt-1 text-[11px]" style={{ color }}>{delta}</div>}
    </div>
  );
}
