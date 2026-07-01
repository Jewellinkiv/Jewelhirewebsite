"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { STORE_NAV } from "@/components/Sidebar";
import { IconMenu, IconX, IconDiamond, IconSettings } from "@/components/icons";

// Mobile nav for the store shell — the desktop Sidebar is hidden < lg, so this
// gives store-owner navigation a hamburger + slide-over on small screens.
export function MobileNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="lg:hidden">
      <button onClick={() => setOpen(true)} className="w-[34px] h-[34px] rounded-md border border-line bg-panel text-muted flex items-center justify-center" aria-label="Menu">
        <IconMenu size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative w-[260px] max-w-[82%] bg-panel h-full overflow-y-auto shadow-xl">
            <div className="flex items-center gap-2.5 px-4 py-4 border-b border-line">
              <span className="w-7 h-7 rounded-[7px] bg-brand-grad text-white flex items-center justify-center"><IconDiamond size={17} /></span>
              <span className="text-[16px] text-head font-medium">Jewel<span className="font-extrabold">Hire</span></span>
              <button onClick={() => setOpen(false)} className="ml-auto w-8 h-8 rounded-md text-muted hover:bg-rowhover flex items-center justify-center" aria-label="Close"><IconX size={18} /></button>
            </div>
            <nav className="px-2.5 py-2">
              {STORE_NAV.map((g) => (
                <div key={g.group}>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted px-2.5 pt-3 pb-1.5">{g.group}</div>
                  {g.items.map((it) => {
                    const on = isActive(it.href);
                    return (
                      <Link key={it.href} href={it.href} onClick={() => setOpen(false)} className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-[14px] mb-px no-underline ${on ? "bg-[#e8f1ff] text-primary font-medium" : "text-body hover:bg-rowhover"}`}>
                        <span className={on ? "text-primary" : "text-muted"}>{it.icon}</span>{it.label}
                        {it.count != null && <span className="ml-auto text-[11px] rounded-full px-[7px] py-px bg-[#eef2f7] text-muted">{it.count}</span>}
                      </Link>
                    );
                  })}
                </div>
              ))}
              <div className="pt-3">
                <Link href="/settings" onClick={() => setOpen(false)} className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-[14px] no-underline ${isActive("/settings") ? "bg-[#e8f1ff] text-primary font-medium" : "text-body hover:bg-rowhover"}`}>
                  <span className="text-muted"><IconSettings size={18} /></span>Settings
                </Link>
              </div>
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
