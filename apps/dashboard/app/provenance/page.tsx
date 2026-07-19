"use client";

import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";

export default function Page() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t("nav.provenance")} sub={t("app.tag")} />
      <div className="panel scanline p-6">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Ed25519-signed Content Passports with layered recovery — exact digest, content-defined fuzzy fingerprint,
          and perceptual hashing. Verification returns discrete evidence states, never a single trust score.
        </p>
      </div>
    </div>
  );
}
