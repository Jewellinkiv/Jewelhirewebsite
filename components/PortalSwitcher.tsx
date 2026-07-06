"use client";

import { useState } from "react";
import Link from "next/link";
import { PORTAL_LINKS, AppRole } from "@/lib/session";
import { IconChevronDown } from "@/components/icons";

const LABEL: Record<AppRole, string> = { store_owner: "Store", associate: "My portal", admin: "Admin" };

export function PortalSwitcher({ current, dark = false }: { current: AppRole; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium border ${dark ? "border-[#1c2942] text-[#9fb2d4] hover:bg-[#111d31]" : "border-line text-body hover:bg-rowhover bg-panel"}`}
      >
        {LABEL[current]} <IconChevronDown size={13} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute right-0 mt-1 z-50 w-[160px] rounded-md border shadow-lg py-1 ${dark ? "bg-[#0f1b30] border-[#1c2942]" : "bg-white border-line"}`}>
            <div className={`px-3 py-1 text-[10.5px] font-semibold uppercase tracking-wide ${dark ? "text-[#6b82a8]" : "text-muted"}`}>Switch portal</div>
            {PORTAL_LINKS.map((p) => (
              <Link key={p.role} href={p.href} onClick={() => setOpen(false)} className={`block px-3 py-1.5 text-[13px] no-underline ${p.role === current ? (dark ? "text-[#5b9bff]" : "text-primary font-medium") : dark ? "text-[#9fb2d4] hover:bg-[#16243d]" : "text-body hover:bg-rowhover"}`}>
                {p.label}
              </Link>
            ))}
            <div className={`my-1 border-t ${dark ? "border-[#1c2942]" : "border-line"}`} />
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className={`block w-full text-left px-3 py-1.5 text-[13px] ${dark ? "text-[#f1a6a6] hover:bg-[#16243d]" : "text-[#a32d2d] hover:bg-[#fcebeb]"}`}
              >
                Log out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
