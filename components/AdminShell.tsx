"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconDiamond, IconLayoutDashboard, IconBriefcase, IconUsers, IconClipboardList, IconSettings, IconProgress, IconSchool, IconMenu, IconX } from "@/components/icons";
import { LogoutButton } from "@/components/LogoutButton";

const NAV = [
  { label: "Overview", href: "/admin", icon: <IconLayoutDashboard size={18} /> },
  { label: "Companies", href: "/admin/companies", icon: <IconBriefcase size={18} /> },
  { label: "Billing", href: "/admin/billing", icon: <IconProgress size={18} /> },
  { label: "Assessment library", href: "/admin/assessments", icon: <IconClipboardList size={18} /> },
  { label: "Courses", href: "/admin/courses", icon: <IconSchool size={18} /> },
  { label: "Support", href: "/admin/support", icon: <IconUsers size={18} /> },
  { label: "Analytics", href: "/admin/analytics", icon: <IconSettings size={18} /> },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

  return (
    <div className="flex min-h-screen bg-[#0b1424]">
      <aside className="w-[222px] bg-[#0b1424] border-r border-[#1c2942] sticky top-0 h-screen hidden lg:flex flex-col">
        <div className="flex items-center gap-2.5 px-[18px] py-4 text-[16px] text-white">
          <span className="w-7 h-7 rounded-[7px] bg-brand-grad flex items-center justify-center"><IconDiamond size={17} /></span>
          <span className="font-medium">Jewel<span className="font-extrabold">Hire</span></span>
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-[#7fa0d6] bg-[#16243d] px-1.5 py-0.5 rounded">Admin</span>
        </div>
        <nav className="px-2.5 flex-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13.5px] mb-px no-underline ${active(n.href) ? "bg-[#16243d] text-white font-medium" : "text-[#9fb2d4] hover:bg-[#111d31]"}`}>
              <span className={active(n.href) ? "text-[#5b9bff]" : "text-[#6b82a8]"}>{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-[#1c2942] flex items-center justify-between gap-2">
          <LogoutButton dark />
        </div>
      </aside>
      <div className="flex-1 min-w-0 bg-page">
        {/* mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-[#0b1424] text-white flex items-center gap-2 px-4 h-[52px]">
          <button onClick={() => setOpen((o) => !o)} className="w-9 h-9 -ml-1 rounded-md text-[#9fb2d4] hover:bg-[#16243d] flex items-center justify-center" aria-label="Menu">
            {open ? <IconX size={20} /> : <IconMenu size={20} />}
          </button>
          <span className="w-6 h-6 rounded-[6px] bg-brand-grad flex items-center justify-center"><IconDiamond size={15} /></span>
          <span className="text-[15px] font-medium">Jewel<span className="font-extrabold">Hire</span></span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#7fa0d6] bg-[#16243d] px-1.5 py-0.5 rounded">Admin</span>
          <div className="ml-auto flex items-center gap-2">
            <LogoutButton dark compact />
          </div>
        </div>
        {open && (
          <nav className="lg:hidden bg-[#0b1424] border-b border-[#1c2942] px-2.5 py-2 flex flex-col gap-0.5">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-[14px] no-underline ${active(n.href) ? "bg-[#16243d] text-white font-medium" : "text-[#9fb2d4] hover:bg-[#111d31]"}`}>
                <span className={active(n.href) ? "text-[#5b9bff]" : "text-[#6b82a8]"}>{n.icon}</span>{n.label}
              </Link>
            ))}
            <div className="px-2.5 pt-2">
              <LogoutButton dark />
            </div>
          </nav>
        )}
        <main className="p-[22px] max-w-[1280px] w-full">{children}</main>
      </div>
    </div>
  );
}
