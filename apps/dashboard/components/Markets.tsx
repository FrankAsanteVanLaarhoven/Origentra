"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface Rate { sym: string; rate: number }

export function Markets() {
  const { t } = useI18n();
  const [d, setD] = useState<{ base: string; date: string; rates: Rate[] } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/fx").then((r) => r.json()).then((x) => alive && setD(x)).catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm" style={{ color: "var(--muted)" }}>{t("section.markets")} · {d?.base ?? "USD"}</span>
        <span className="mono text-[11px]" style={{ color: "var(--muted)" }}>{d?.date || "—"}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(d?.rates ?? []).map((r) => (
          <div key={r.sym} className="flex flex-col rise">
            <span className="mono text-[11px]" style={{ color: "var(--muted)" }}>{d?.base}/{r.sym}</span>
            <span className="stat-value text-lg">{r.rate.toFixed(r.rate < 10 ? 4 : 2)}</span>
          </div>
        ))}
        {!d && <span className="text-sm" style={{ color: "var(--muted)" }}>Loading…</span>}
      </div>
    </div>
  );
}
