"use client";

import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { LiveAnalytics } from "@/components/LiveAnalytics";

export default function Page() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t("nav.analytics")} sub={t("section.dataflow")} />
      <LiveAnalytics />
    </div>
  );
}
