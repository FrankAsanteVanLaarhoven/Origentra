"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface Item { title: string; url: string; source: string; time: number; score: number }

export function NewsFeed() {
  const { t } = useI18n();
  const [d, setD] = useState<{ source: string; items: Item[] } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/news").then((r) => r.json()).then((x) => alive && setD(x)).catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <div className="panel overflow-hidden p-0">
      <div className="hairline flex items-center justify-between px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <span className="text-sm" style={{ color: "var(--muted)" }}>{t("section.news")}</span>
        <span className="mono text-[11px]" style={{ color: "var(--neon)" }}>{d?.source ? `⛁ ${d.source}` : "…"}</span>
      </div>
      <div className="max-h-72 overflow-auto">
        {(d?.items ?? []).map((it, i) => (
          // External links are intercepted by AppShell and open in the in-app window.
          <a key={i} href={it.url} className="hairline rise flex items-start gap-3 px-4 py-3 text-sm" style={{ borderColor: "var(--border)" }}>
            <span className="mono mt-[2px] text-[11px]" style={{ color: "var(--neon)" }}>{String(i + 1).padStart(2, "0")}</span>
            <span className="flex-1" style={{ color: "var(--text)" }}>{it.title}</span>
            <span className="mono whitespace-nowrap text-[11px]" style={{ color: "var(--muted)" }}>▲{it.score}</span>
          </a>
        ))}
        {!d && <div className="px-4 py-6 text-sm" style={{ color: "var(--muted)" }}>Loading feed…</div>}
        {d && d.items.length === 0 && <div className="px-4 py-6 text-sm" style={{ color: "var(--muted)" }}>Feed unavailable.</div>}
      </div>
    </div>
  );
}
