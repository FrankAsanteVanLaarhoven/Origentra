"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemePref = "system" | "dark" | "light";
const KEY = "origentra-theme";

function resolve(pref: ThemePref): "dark" | "light" {
  if (pref === "system") {
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return pref;
}

interface ThemeCtx {
  pref: ThemePref;
  resolved: "dark" | "light";
  setPref: (p: ThemePref) => void;
  cycle: () => void;
}
const Ctx = createContext<ThemeCtx>(null!);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>("system");
  const [resolved, setResolved] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = (localStorage.getItem(KEY) as ThemePref) || "system";
    setPrefState(stored);
  }, []);

  useEffect(() => {
    const apply = () => {
      const r = resolve(pref);
      setResolved(r);
      document.documentElement.dataset.theme = r;
    };
    apply();
    localStorage.setItem(KEY, pref);
    if (pref === "system") {
      const m = window.matchMedia("(prefers-color-scheme: light)");
      m.addEventListener("change", apply);
      return () => m.removeEventListener("change", apply);
    }
  }, [pref]);

  const setPref = useCallback((p: ThemePref) => setPrefState(p), []);
  const cycle = useCallback(() => setPrefState((p) => (p === "system" ? "dark" : p === "dark" ? "light" : "system")), []);

  return <Ctx.Provider value={{ pref, resolved, setPref, cycle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
