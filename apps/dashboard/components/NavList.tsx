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

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { t } = useI18n();

  const item = (href: string, key: string, icon: string) => {
    const active = href === "/" ? path === "/" : path.startsWith(href);
    return (
      <Link key={href} href={href} onClick={onNavigate} className={`nav ${active ? "active" : ""}`}>
        <span className="mono" style={{ width: 18, textAlign: "center", color: active ? "var(--neon)" : "inherit" }}>{icon}</span>
        <span className="text-sm">{t(key)}</span>
      </Link>
    );
  };

  return (
    <>
      <div className="mb-3 flex items-center gap-2 px-2 py-3">
        <span className="dot pulse" style={{ color: "var(--neon)" }} />
        <span className="mono glow-text text-lg tracking-[0.32em]">{t("app.name")}</span>
      </div>
      {ITEMS.map((it) => item(it.href, it.key, it.icon))}
      <div className="hairline mt-auto pt-3">
        {item("/settings", "nav.settings", "⚙")}
        {item("/profile", "nav.profile", "◐")}
        <div className="mono mt-3 flex items-center gap-2 px-2 text-[11px]" style={{ color: "var(--muted)" }}>
          <span className="dot" style={{ color: "var(--ok)" }} />
          {t("label.operational")}
        </div>
      </div>
    </>
  );
}
