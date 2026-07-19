"use client";

import { useState } from "react";
import { useTheme } from "@/lib/theme";
import { useSound } from "@/lib/sound";
import { useI18n } from "@/lib/i18n";
import { LANGUAGES } from "@/lib/dict";

export function ThemeToggle() {
  const { pref, cycle } = useTheme();
  const { play } = useSound();
  const icon = pref === "dark" ? "☾" : pref === "light" ? "☀" : "⊙";
  return (
    <button className="neon px-3 py-2 text-sm" title="Theme" onClick={() => { cycle(); play("toggle"); }}>
      {icon}
    </button>
  );
}

export function SoundToggle() {
  const { enabled, toggle } = useSound();
  return (
    <button className={`neon px-3 py-2 text-sm ${enabled ? "on" : ""}`} title="Sound" style={{ opacity: enabled ? 1 : 0.55 }} onClick={toggle}>
      ♪
    </button>
  );
}

export function LangSwitcher() {
  const { lang, setLang } = useI18n();
  const { play } = useSound();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="neon mono px-3 py-2 text-sm" onClick={() => { setOpen((o) => !o); play("click"); }}>
        {lang.toUpperCase()}
      </button>
      {open && (
        <div className="panel absolute right-0 z-40 mt-2 max-h-72 overflow-auto p-1" style={{ minWidth: 190 }} onMouseLeave={() => setOpen(false)}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              className="nav w-full justify-between text-sm"
              onClick={() => { setLang(l.code); setOpen(false); play("nav"); }}
            >
              <span style={{ color: l.code === lang ? "var(--neon)" : "inherit" }}>{l.native}</span>
              <span className="mono text-[11px]" style={{ color: "var(--muted)" }}>{l.full ? l.code : `${l.code} ·`}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
