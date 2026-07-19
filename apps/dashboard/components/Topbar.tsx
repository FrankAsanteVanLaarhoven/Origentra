"use client";

import { useI18n } from "@/lib/i18n";
import { ThemeToggle, LangSwitcher, SoundToggle } from "./controls";
import { MiniClock } from "./WorldClock";
import { PiPButton } from "./PiPButton";

export function Topbar({ onMenu }: { onMenu?: () => void }) {
  const { t, isDraft } = useI18n();
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-2 border-b px-3 py-3 backdrop-blur sm:gap-3 sm:px-5"
      style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--bg) 72%, transparent)" }}
    >
      <button className="neon px-3 py-2 text-sm md:hidden" title="Menu" onClick={onMenu}>☰</button>
      <div className="flex max-w-md flex-1 items-center gap-2">
        <div className="neon flex w-full items-center gap-2 px-3 py-2">
          <span className="mono text-xs" style={{ color: "var(--muted)" }}>⌕</span>
          <input placeholder={t("action.search")} className="w-full bg-transparent text-sm outline-none" style={{ color: "var(--text)" }} />
          <span className="kbd">⌘K</span>
        </div>
      </div>
      {isDraft && (
        <span className="mono hidden rounded px-2 py-1 text-[10px] sm:inline" style={{ border: "1px solid var(--warn)", color: "var(--warn)" }} title="Draft translation — pending professional review">
          DRAFT ⚠
        </span>
      )}
      <MiniClock />
      <div className="flex items-center gap-2">
        <PiPButton />
        <SoundToggle />
        <LangSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
