"use client";

/** Zero-dependency SVG charts. Colors use CSS vars via `style` so they follow the
 *  theme; `vectorEffect` keeps strokes crisp under non-uniform scaling. */

function scale(data: number[]) {
  const max = Math.max(1, ...data);
  const min = Math.min(...data);
  const rng = Math.max(1, max - min);
  return { x: (i: number) => (i / Math.max(1, data.length - 1)) * 100, y: (v: number) => 100 - ((v - min) / rng) * 90 - 5 };
}

export function Sparkline({ data, color = "var(--neon)", height = 28 }: { data: number[]; color?: string; height?: number }) {
  if (data.length < 2) return <div style={{ height }} />;
  const s = scale(data);
  const pts = data.map((v, i) => `${s.x(i).toFixed(1)},${s.y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height }}>
      <polyline points={pts} style={{ fill: "none", stroke: color, filter: `drop-shadow(0 0 2px ${color})` }} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function AreaChart({ data, height = 130 }: { data: number[]; height?: number }) {
  if (data.length < 2) return <div style={{ height }} />;
  const s = scale(data);
  const pts = data.map((v, i) => `${s.x(i).toFixed(2)},${s.y(v).toFixed(2)}`);
  const line = `M${pts.join(" L")}`;
  const area = `M0,100 L${pts.join(" L")} L100,100 Z`;

  // 5-point moving average overlay
  const ma = data.map((_, i) => {
    const w = data.slice(Math.max(0, i - 4), i + 1);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
  const maLine = `M${ma.map((v, i) => `${s.x(i).toFixed(2)},${s.y(v).toFixed(2)}`).join(" L")}`;

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height }}>
      <defs>
        <linearGradient id="area-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" style={{ stopColor: "rgba(var(--neon-rgb),0.35)" }} />
          <stop offset="100%" style={{ stopColor: "rgba(var(--neon-rgb),0)" }} />
        </linearGradient>
      </defs>
      <path d={area} style={{ fill: "url(#area-grad)" }} />
      <path d={maLine} style={{ fill: "none", stroke: "rgba(var(--neon2-rgb),0.55)" }} strokeWidth={0.8} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      <path d={line} style={{ fill: "none", stroke: "var(--neon)", filter: "drop-shadow(0 0 3px rgba(var(--neon-rgb),0.8))" }} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
