"use client";

import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";

export default function Page() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t("nav.abuse")} sub={t("app.tag")} />
      <div className="panel scanline p-6">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Recommend-only abuse-signal exchange — quorum-gated, appealable, transparency-logged. Origentra shares
          accountable evidence with confidence and alternatives; it never enforces or bans. Consumers decide.
        </p>
      </div>
    </div>
  );
}
