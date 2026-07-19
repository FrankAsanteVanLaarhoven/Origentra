"use client";

import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";

const SCOPES = ["asset:register", "publish:propose", "publish:approve"];

export default function Page() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t("nav.profile")} />
      <div className="panel flex max-w-2xl items-center gap-5 p-6">
        <div
          className="grid place-items-center rounded-full"
          style={{ width: 72, height: 72, background: "radial-gradient(circle at 30% 30%, var(--neon), var(--neon-2))", boxShadow: "0 0 24px rgba(var(--neon-rgb),0.5)" }}
        >
          <span className="mono text-2xl" style={{ color: "#00131a" }}>F</span>
        </div>
        <div>
          <div className="text-xl font-semibold">Frank Asante Van Laarhoven</div>
          <div className="mono text-sm" style={{ color: "var(--muted)" }}>Principal · tenant-acme</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {SCOPES.map((s) => (
              <span key={s} className="mono rounded px-2 py-1 text-[11px]" style={{ border: "1px solid var(--border-strong)", color: "var(--neon)" }}>{s}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
