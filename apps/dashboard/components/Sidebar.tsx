"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";

const ITEMS = [
  { href: "/", key: "nav.overview", icon: "◎" },
  { href: "/analytics", key: "nav.analytics", icon: "▤" },
  { href: "/identity", key: "nav.identity", icon: "❖" },
  { href: "/provenance", key: "nav.provenance", icon: "⛓" },
  { href: "/abuse", key: "nav.abuse", icon: "⚠" },
];

export function Sidebar() {
  const path = usePathname();
  const { t } = useI18n();
  return (
    <aside
      className="hidden flex-col gap-1 border-r p-4 md:flex"
      style={{ borderColor: "var(--border)", background: "linear-gradient(180deg, var(--bg-2), transparent 60%)" }}
    >
      <div className="mb-3 flex items-center gap-2 px-2 py-3">
        <span className="dot pulse" style={{ color: "var(--neon)" }} />
        <span className="mono glow-text text-lg tracking-[0.32em]">{t("app.name")}</span>
      </div>
      {ITEMS.map((it) => {
        const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} className={`nav ${active ? "active" : ""}`}>
            <span className="mono" style={{ width: 18, textAlign: "center", color: active ? "var(--neon)" : "inherit" }}>{it.icon}</span>
            <span className="text-sm">{t(it.key)}</span>
          </Link>
        );
      })}
      <div className="hairline mt-auto pt-3">
        <Link href="/settings" className={`nav ${path.startsWith("/settings") ? "active" : ""}`}>
          <span className="mono" style={{ width: 18, textAlign: "center" }}>⚙</span>
          <span className="text-sm">{t("nav.settings")}</span>
        </Link>
        <Link href="/profile" className={`nav ${path.startsWith("/profile") ? "active" : ""}`}>
          <span className="mono" style={{ width: 18, textAlign: "center" }}>◐</span>
          <span className="text-sm">{t("nav.profile")}</span>
        </Link>
        <div className="mono mt-3 flex items-center gap-2 px-2 text-[11px]" style={{ color: "var(--muted)" }}>
          <span className="dot" style={{ color: "var(--ok)" }} />
          {t("label.operational")}
        </div>
      </div>
    </aside>
  );
}
