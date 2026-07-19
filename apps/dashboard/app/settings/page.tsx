"use client";

import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useSound } from "@/lib/sound";
import { ThemeToggle, LangSwitcher, SoundToggle } from "@/components/controls";
import { PageHeader } from "@/components/PageHeader";
import { LANGUAGES } from "@/lib/dict";

function Row({ label, value, control }: { label: string; value: string; control: React.ReactNode }) {
  return (
    <div className="hairline flex items-center justify-between px-4 py-4" style={{ borderColor: "var(--border)" }}>
      <div>
        <div className="text-sm" style={{ color: "var(--text)" }}>{label}</div>
        <div className="mono text-[11px]" style={{ color: "var(--muted)" }}>{value}</div>
      </div>
      {control}
    </div>
  );
}

export default function Page() {
  const { t, lang } = useI18n();
  const { pref } = useTheme();
  const { enabled } = useSound();
  return (
    <div>
      <PageHeader title={t("nav.settings")} sub={t("app.tag")} />
      <div className="panel max-w-2xl overflow-hidden">
        <Row label={t("label.theme")} value={pref} control={<ThemeToggle />} />
        <Row label={t("label.language")} value={LANGUAGES.find((l) => l.code === lang)?.native ?? lang} control={<LangSwitcher />} />
        <Row label={t("label.sound")} value={enabled ? "on" : "off"} control={<SoundToggle />} />
      </div>
    </div>
  );
}
