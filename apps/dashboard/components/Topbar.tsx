"use client";

import { useI18n } from "@/lib/i18n";
import { ThemeToggle, LangSwitcher, SoundToggle } from "./controls";
import { MiniClock } from "./WorldClock";

export function Topbar() {
  const { t } = useI18n();
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 border-b px-5 py-3 backdrop-blur"
      style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--bg) 72%, transparent)" }}
    >
      <div className="flex max-w-md flex-1 items-center gap-2">
        <div className="neon flex w-full items-center gap-2 px-3 py-2">
          <span className="mono text-xs" style={{ color: "var(--muted)" }}>⌕</span>
          <input placeholder={t("action.search")} className="w-full bg-transparent text-sm outline-none" style={{ color: "var(--text)" }} />
          <span className="kbd">⌘K</span>
        </div>
      </div>
      <MiniClock />
      <div className="flex items-center gap-2">
        <SoundToggle />
        <LangSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
