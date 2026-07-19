"use client";

import { useEffect, useState } from "react";

const ZONES = [
  { c: "SFO", tz: "America/Los_Angeles" },
  { c: "NYC", tz: "America/New_York" },
  { c: "LON", tz: "Europe/London" },
  { c: "BER", tz: "Europe/Berlin" },
  { c: "DXB", tz: "Asia/Dubai" },
  { c: "TYO", tz: "Asia/Tokyo" },
];

function useNow() {
  const [n, setN] = useState<Date | null>(null);
  useEffect(() => {
    setN(new Date());
    const id = setInterval(() => setN(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return n;
}

function fmt(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: tz, hour12: false }).format(d);
}

export function MiniClock() {
  const n = useNow();
  if (!n) return null;
  return (
    <div className="neon mono hidden items-center gap-2 px-3 py-2 text-sm sm:flex">
      <span className="dot pulse" style={{ color: "var(--neon)" }} />
      {fmt(n, Intl.DateTimeFormat().resolvedOptions().timeZone)}
    </div>
  );
}

export function WorldClock() {
  const n = useNow();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {ZONES.map((z) => (
        <div key={z.c} className="flex flex-col">
          <span className="mono text-[11px]" style={{ color: "var(--muted)" }}>{z.c}</span>
          <span className="stat-value text-xl">{n ? fmt(n, z.tz) : "--:--:--"}</span>
        </div>
      ))}
    </div>
  );
}
