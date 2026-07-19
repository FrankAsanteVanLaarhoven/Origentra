"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface Day { date: string; min: number; max: number; code: number }

function glyph(c: number) {
  if (c === 0) return "☀";
  if (c <= 3) return "⛅";
  if (c < 50) return "☁";
  if (c < 70) return "🌧";
  if (c < 80) return "❄";
  return "⛈";
}

export function Weather() {
  const { t } = useI18n();
  const [days, setDays] = useState<Day[] | null>(null);
  const [place, setPlace] = useState("");

  useEffect(() => {
    fetch("/api/weather")
      .then((r) => r.json())
      .then((d) => { setDays(d.days ?? []); setPlace(d.place ?? ""); })
      .catch(() => setDays([]));
  }, []);

  const cells: (Day | null)[] = days && days.length ? days : Array.from({ length: 7 }, () => null);
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm" style={{ color: "var(--muted)" }}>{t("section.weather")}</span>
        <span className="mono text-xs" style={{ color: "var(--muted)" }}>{place || "—"}</span>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((d, i) => (
          <div key={i} className="rise flex flex-col items-center gap-1">
            <span className="mono text-[11px]" style={{ color: "var(--muted)" }}>
              {d ? new Date(d.date).toLocaleDateString("en", { weekday: "short" }) : "—"}
            </span>
            <span className="text-xl">{d ? glyph(d.code) : "·"}</span>
            <span className="mono text-xs">{d ? `${Math.round(d.max)}°` : "--"}</span>
            <span className="mono text-[11px]" style={{ color: "var(--muted)" }}>{d ? `${Math.round(d.min)}°` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
