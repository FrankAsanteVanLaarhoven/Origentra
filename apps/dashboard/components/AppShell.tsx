"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { EmbedModal } from "./EmbedModal";

/** App frame. Intercepts external links so nothing navigates away — they open in
 *  an in-app embed window instead. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [embed, setEmbed] = useState<string | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest("a") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") || "";
      const isExternal = /^https?:\/\//i.test(href) && !href.includes(location.host);
      if (isExternal || a.target === "_blank") {
        e.preventDefault();
        setEmbed(href);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div className="min-h-[100dvh] md:grid md:grid-cols-[248px_1fr]">
      <Sidebar />
      <div className="flex min-w-0 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1 overflow-y-auto p-5 md:p-7">{children}</main>
      </div>
      {embed && <EmbedModal url={embed} onClose={() => setEmbed(null)} />}
    </div>
  );
}
