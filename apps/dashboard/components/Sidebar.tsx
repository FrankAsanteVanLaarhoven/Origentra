"use client";

import { NavList } from "./NavList";

export function Sidebar() {
  return (
    <aside
      className="hidden flex-col gap-1 border-r p-4 md:flex"
      style={{ borderColor: "var(--border)", background: "linear-gradient(180deg, var(--bg-2), transparent 60%)" }}
    >
      <NavList />
    </aside>
  );
}
