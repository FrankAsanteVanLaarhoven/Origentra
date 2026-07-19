"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DICTS, LANGUAGES, type Lang } from "./dict";

const KEY = "origentra-lang";

interface I18nCtx {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (l: Lang) => void;
  t: (k: string) => string;
}
const Ctx = createContext<I18nCtx>(null!);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const s = localStorage.getItem(KEY) as Lang | null;
    if (s && LANGUAGES.some((l) => l.code === s)) setLangState(s);
  }, []);

  useEffect(() => {
    const meta = LANGUAGES.find((l) => l.code === lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = meta?.rtl ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(KEY, l);
  }, []);

  const t = useCallback(
    (k: string) => {
      const d = DICTS[lang] ?? DICTS.en!;
      return d[k] ?? DICTS.en![k] ?? k;
    },
    [lang],
  );

  const dir = LANGUAGES.find((l) => l.code === lang)?.rtl ? "rtl" : "ltr";
  return <Ctx.Provider value={{ lang, dir, setLang, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
