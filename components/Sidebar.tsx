"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDiamond,
  IconLayoutDashboard,
  IconProgress,
  IconUsers,
  IconBriefcase,
  IconSend,
  IconLink,
  IconCalendar,
  IconUsersGroup,
  IconClipboardList,
  IconIdBadge2,
  IconPlayerPlay,
  IconSchool,
  IconSettings,
} from "@/components/icons";

export type NavItem = { label: string; href: string; icon: React.ReactNode; count?: number };
export type NavGroup = { group: string; items: NavItem[] };

export const STORE_NAV: NavGroup[] = [
  {
    group: "Hiring",
    items: [
      { label: "Dashboard", href: "/", icon: <IconLayoutDashboard size={18} /> },
      { label: "Pipeline", href: "/pipeline", icon: <IconProgress size={18} /> },
      { label: "Applicants", href: "/applicants", icon: <IconUsers size={18} /> },
      { label: "Jobs", href: "/jobs", icon: <IconBriefcase size={18} /> },
      { label: "Public page", href: "/public-page", icon: <IconLink size={18} /> },
      { label: "Interviews", href: "/interviews", icon: <IconCalendar size={18} /> },
      { label: "Cert invitations", href: "/cert-invitations", icon: <IconSend size={18} /> },
    ],
  },
  {
    group: "JewelCert",
    items: [
      { label: "Sent & results", href: "/jewelcert", icon: <IconDiamond size={18} /> },
      { label: "Team map", href: "/team-map", icon: <IconUsersGroup size={18} /> },
      { label: "Assessments", href: "/assessments", icon: <IconClipboardList size={18} /> },
      { label: "Courses", href: "/courses", icon: <IconSchool size={18} /> },
    ],
  },
  {
    group: "Team",
    items: [
      { label: "Team", href: "/team", icon: <IconUsersGroup size={18} /> },
      { label: "Roster", href: "/roster", icon: <IconIdBadge2 size={18} /> },
      { label: "Training Center", href: "/learn", icon: <IconPlayerPlay size={18} /> },
    ],
  },
];

export function Sidebar({ canManageSettings }: { canManageSettings: boolean }) {
  const path = usePathname();
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(href + "/");

  return (
    <aside className="w-[226px] bg-panel border-r border-line sticky top-0 h-screen hidden lg:flex flex-col">
      <div className="flex items-center gap-2.5 px-[18px] py-4 text-[17px] text-head">
        <span className="w-7 h-7 rounded-[7px] bg-brand-grad text-white flex items-center justify-center">
          <IconDiamond size={18} />
        </span>
        <span className="font-medium">Jewel<span className="font-extrabold">Hire</span></span>
      </div>
      <nav className="px-2.5 flex-1 overflow-y-auto pb-4">
        {STORE_NAV.map((g) => (
          <div key={g.group}>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted px-2.5 pt-3.5 pb-1.5">
              {g.group}
            </div>
            {g.items.map((it) => {
              const on = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13.5px] mb-px no-underline ${
                    on ? "bg-[#e8f1ff] text-primary font-medium" : "text-body hover:bg-rowhover"
                  }`}
                >
                  <span className={on ? "text-primary" : "text-muted"}>{it.icon}</span>
                  {it.label}
                  {it.count != null && (
                    <span
                      className={`ml-auto text-[11px] rounded-full px-[7px] py-px ${
                        on ? "bg-[#d7e6ff] text-primary" : "bg-[#eef2f7] text-muted"
                      }`}
                    >
                      {it.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
        {canManageSettings && <div className="pt-3.5">
          <Link
            href="/settings"
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13.5px] no-underline ${
              isActive("/settings") ? "bg-[#e8f1ff] text-primary font-medium" : "text-body hover:bg-rowhover"
            }`}
          >
            <span className="text-muted">
              <IconSettings size={18} />
            </span>
            Settings
          </Link>
        </div>}
      </nav>
    </aside>
  );
}
