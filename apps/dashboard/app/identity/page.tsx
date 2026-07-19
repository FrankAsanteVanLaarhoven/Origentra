"use client";

import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";

export default function Page() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t("nav.identity")} sub={t("app.tag")} />
      <div className="panel scanline p-6">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Verified identity graph — signed identity claims with scopes, delegation, expiry and revocation. A
          signature proves integrity; only a trusted signer proves authority.
        </p>
      </div>
    </div>
  );
}
