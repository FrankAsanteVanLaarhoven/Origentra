"use client";

import { NavList } from "./NavList";

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }} />
      <aside
        className="rise absolute bottom-0 left-0 top-0 flex w-[248px] flex-col gap-1 border-r p-4"
        style={{ borderColor: "var(--border)", background: "var(--bg-2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <NavList onNavigate={onClose} />
      </aside>
    </div>
  );
}
