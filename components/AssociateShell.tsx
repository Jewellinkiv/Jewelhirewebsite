"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconDiamond, IconLayoutDashboard, IconBriefcase, IconClipboardList, IconCalendar, IconFileText, IconSchool, IconMenu, IconX } from "@/components/icons";
import { PortalSwitcher } from "@/components/PortalSwitcher";

const NAV = [
  { label: "Home", href: "/portal", icon: <IconLayoutDashboard size={17} /> },
  { label: "Applications", href: "/portal/applications", icon: <IconBriefcase size={17} /> },
  { label: "Invites", href: "/portal/invites", icon: <IconClipboardList size={17} /> },
  { label: "Interviews", href: "/portal/interviews", icon: <IconCalendar size={17} /> },
  { label: "Resume", href: "/portal/resume", icon: <IconFileText size={17} /> },
  { label: "Training", href: "/portal/training", icon: <IconSchool size={17} /> },
];

export function AssociateShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/portal" ? path === "/portal" : path.startsWith(href));

  return (
    <div className="min-h-screen bg-[#f6f8fc]">
      <header className="bg-white border-b border-line sticky top-0 z-30">
        <div className="max-w-[1080px] mx-auto px-5 flex items-center gap-1 h-[58px]">
          <button onClick={() => setOpen((o) => !o)} className="md:hidden w-9 h-9 -ml-1 mr-1 rounded-md text-muted hover:bg-rowhover flex items-center justify-center" aria-label="Menu">
            {open ? <IconX size={20} /> : <IconMenu size={20} />}
          </button>
          <Link href="/portal" className="flex items-center gap-2.5 no-underline mr-4">
            <span className="w-7 h-7 rounded-[7px] bg-brand-grad text-white flex items-center justify-center"><IconDiamond size={17} /></span>
            <span className="text-[16px] text-head font-medium">Jewel<span className="font-extrabold">Hire</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-0.5 flex-1">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[13.5px] no-underline ${active(n.href) ? "bg-[#e8f1ff] text-primary font-medium" : "text-body hover:bg-rowhover"}`}>
                <span className={active(n.href) ? "text-primary" : "text-muted"}>{n.icon}</span>{n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <PortalSwitcher current="associate" />
            <Link href="/portal/profile" className="flex items-center gap-2 no-underline">
              <span className="w-8 h-8 rounded-full bg-[#eef2f7] flex items-center justify-center text-[12px] font-semibold text-[#5b6472]">JS</span>
            </Link>
          </div>
        </div>

        {/* mobile nav */}
        {open && (
          <nav className="md:hidden border-t border-line px-3 py-2 flex flex-col gap-0.5">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[14px] no-underline ${active(n.href) ? "bg-[#e8f1ff] text-primary font-medium" : "text-body hover:bg-rowhover"}`}>
                <span className={active(n.href) ? "text-primary" : "text-muted"}>{n.icon}</span>{n.label}
              </Link>
            ))}
            <Link href="/portal/profile" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[14px] no-underline text-body hover:bg-rowhover">Profile</Link>
          </nav>
        )}
      </header>
      <main className="max-w-[1080px] mx-auto px-5 py-7">{children}</main>
    </div>
  );
}
