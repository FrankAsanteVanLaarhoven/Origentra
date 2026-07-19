"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface Evt { ts: number; actor: string; action: string; subject: string; risk?: number }

export function LiveAnalytics() {
  const { t } = useI18n();
  const [events, setEvents] = useState<Evt[]>([]);
  const [series, setSeries] = useState<number[]>(() => Array(48).fill(0));

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = (m) => {
      try {
        const e = JSON.parse(m.data) as Evt;
        setEvents((p) => [e, ...p].slice(0, 40));
        setSeries((s) => [...s.slice(1), Math.min(100, 24 + (e.risk ?? 1) * 10 + Math.round(Math.random() * 36))]);
      } catch {
        /* ignore malformed frame */
      }
    };
    return () => es.close();
  }, []);

  const max = Math.max(1, ...series);
  return (
    <div className="grid gap-4">
      <div className="panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm" style={{ color: "var(--muted)" }}>{t("section.traffic")} · events/tick</span>
          <span className="dot pulse" style={{ color: "var(--neon)" }} />
        </div>
        <div className="scanline flex h-28 items-end gap-[3px]">
          {series.map((v, i) => (
            <div
              key={i}
              style={{
                height: `${(v / max) * 100}%`,
                width: "100%",
                background: "linear-gradient(180deg, var(--neon), transparent)",
                boxShadow: "0 0 8px rgba(var(--neon-rgb),0.4)",
                borderRadius: 2,
                transition: "height .3s ease",
              }}
            />
          ))}
        </div>
      </div>

      <div className="panel overflow-hidden p-0">
        <div className="hairline flex items-center justify-between px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <span className="text-sm" style={{ color: "var(--muted)" }}>{t("section.events")}</span>
          <span className="mono blink text-[11px]" style={{ color: "var(--neon)" }}>● {t("label.live")}</span>
        </div>
        <div className="max-h-72 overflow-auto">
          {events.map((e, i) => (
            <div key={`${e.ts}-${i}`} className="hairline rise flex items-center gap-3 px-4 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
              <span className="mono text-[11px]" style={{ color: "var(--muted)" }}>{new Date(e.ts).toLocaleTimeString("en-GB", { hour12: false })}</span>
              <span className="mono rounded px-2 py-[2px] text-xs" style={{ border: "1px solid var(--border-strong)", color: "var(--neon)" }}>{e.action}</span>
              <span style={{ color: "var(--text)" }}>{e.actor}</span>
              <span style={{ color: "var(--muted)" }}>→ {e.subject}</span>
              {typeof e.risk === "number" && (
                <span className="mono ml-auto text-[11px]" style={{ color: e.risk >= 3 ? "var(--warn)" : "var(--ok)" }}>risk {e.risk}/6</span>
              )}
            </div>
          ))}
          {events.length === 0 && <div className="px-4 py-6 text-sm" style={{ color: "var(--muted)" }}>Awaiting events…</div>}
        </div>
      </div>
    </div>
  );
}
