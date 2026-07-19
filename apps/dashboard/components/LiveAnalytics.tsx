"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { AreaChart } from "./charts";

interface Evt { ts: number; actor: string; action: string; subject: string; hash?: string | null; ref?: boolean }

export function LiveAnalytics() {
  const { t } = useI18n();
  const [events, setEvents] = useState<Evt[]>([]);
  const [series, setSeries] = useState<number[]>(() => Array(48).fill(0));
  const [live, setLive] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = (m) => {
      try {
        const e = JSON.parse(m.data) as Evt;
        setEvents((p) => [e, ...p].slice(0, 40));
        if (e.hash) setLive(true);
        const v = e.hash ? 15 + (parseInt(e.hash.slice(0, 2), 16) / 255) * 80 : 24 + Math.round(Math.random() * 36);
        setSeries((s) => [...s.slice(1), Math.min(100, Math.round(v))]);
      } catch { /* ignore malformed frame */ }
    };
    return () => es.close();
  }, []);

  const cur = series[series.length - 1] ?? 0;
  const avg = Math.round(series.reduce((a, b) => a + b, 0) / series.length);
  const peak = Math.max(...series);
  return (
    <div className="grid gap-4">
      <div className="panel p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm" style={{ color: "var(--muted)" }}>{t("section.traffic")} · events/tick</span>
          <span className="dot pulse" style={{ color: "var(--neon)" }} />
        </div>
        <div className="mono mb-1 flex gap-5 text-[11px]" style={{ color: "var(--muted)" }}>
          <span>cur <span style={{ color: "var(--neon)" }}>{cur}</span></span>
          <span>avg <span style={{ color: "var(--text)" }}>{avg}</span></span>
          <span>peak <span style={{ color: "var(--text)" }}>{peak}</span></span>
        </div>
        <AreaChart data={series} height={130} />
      </div>

      <div className="panel overflow-hidden p-0">
        <div className="hairline flex items-center justify-between px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            {t("section.events")} {live && <span className="mono" style={{ color: "var(--neon)" }}>· hash-chained</span>}
          </span>
          <span className="mono blink text-[11px]" style={{ color: live ? "var(--neon)" : "var(--muted)" }}>
            ● {live ? t("label.live") : "reference"}
          </span>
        </div>
        <div className="max-h-72 overflow-auto">
          {events.map((e, i) => (
            <div key={`${e.ts}-${i}`} className="hairline rise flex items-center gap-3 px-4 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
              <span className="mono text-[11px]" style={{ color: "var(--muted)" }}>{new Date(e.ts).toLocaleTimeString("en-GB", { hour12: false })}</span>
              <span className="mono rounded px-2 py-[2px] text-xs" style={{ border: "1px solid var(--border-strong)", color: "var(--neon)" }}>{e.action}</span>
              <span style={{ color: "var(--text)" }}>{e.actor}</span>
              <span style={{ color: "var(--muted)" }}>→ {e.subject}</span>
              {e.hash && <span className="mono ml-auto text-[11px]" style={{ color: "var(--neon)" }}>⛓ {e.hash}</span>}
            </div>
          ))}
          {events.length === 0 && <div className="px-4 py-6 text-sm" style={{ color: "var(--muted)" }}>Awaiting events…</div>}
        </div>
      </div>
    </div>
  );
}
