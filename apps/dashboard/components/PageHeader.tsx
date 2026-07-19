export function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-2 rise">
      <div>
        <h1 className="glow-text text-2xl font-semibold">{title}</h1>
        {sub && <p className="text-sm" style={{ color: "var(--muted)" }}>{sub}</p>}
      </div>
    </div>
  );
}
