"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { StatTile } from "@/components/StatTile";
import { WorldClock } from "@/components/WorldClock";
import { Weather } from "@/components/Weather";
import { LiveAnalytics } from "@/components/LiveAnalytics";
import { Markets } from "@/components/Markets";
import { NewsFeed } from "@/components/NewsFeed";

interface Stats { validity: string; throughput: string; latency: string; blocked: string }

export default function Home() {
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/stats").then((r) => r.json()).then((s) => alive && setStats(s)).catch(() => {});
    load();
    const id = setInterval(load, 3000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <div className="grid gap-5 rise">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="glow-text text-2xl font-semibold">{t("nav.overview")}</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{t("app.tag")}</p>
        </div>
        <div className="mono flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
          <span className="dot" style={{ color: "var(--ok)" }} />
          {t("label.operational")}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t("kpi.validity")} value={stats?.validity ?? "99.9"} unit="%" delta="+0.0" tone="ok" />
        <StatTile label={t("kpi.throughput")} value={stats?.throughput ?? "—"} unit="ev/s" delta={t("label.live")} tone="neon" />
        <StatTile label={t("kpi.latency")} value={stats?.latency ?? "—"} unit="ms" tone="neon" />
        <StatTile label={t("kpi.blocked")} value={stats?.blocked ?? "0"} tone="warn" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-4 lg:col-span-1">
          <div className="mb-3 text-sm" style={{ color: "var(--muted)" }}>{t("section.clock")}</div>
          <WorldClock />
        </div>
        <div className="lg:col-span-2">
          <Weather />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Markets />
        <NewsFeed />
      </div>

      <div>
        <div className="mb-3 text-sm" style={{ color: "var(--muted)" }}>{t("section.dataflow")}</div>
        <LiveAnalytics />
      </div>
    </div>
  );
}
