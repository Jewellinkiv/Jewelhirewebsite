"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui";
import { AdminCompany, COMPANIES, adminMetrics, STATUS_STYLE, PLAN_STYLE } from "@/lib/admin";
import { IconBriefcase, IconUsers, IconClipboardList, IconCheck, IconChevronRight } from "@/components/icons";

export default function AdminOverview() {
  const fallbackMetrics = adminMetrics();
  const [m, setMetrics] = useState(fallbackMetrics);
  const [recent, setRecent] = useState<AdminCompany[]>([...COMPANIES].slice(0, 4));
  const stats = [
    { k: "Companies", v: m.companies, s: `${m.active} active`, icon: <IconBriefcase size={16} /> },
    { k: "Stores", v: m.stores, s: "across companies", icon: <IconUsers size={16} /> },
    { k: "Assessments sent", v: m.assessmentsSent, s: "all-time", icon: <IconClipboardList size={16} /> },
    { k: "Hires", v: m.hires, s: "all-time", icon: <IconCheck size={16} /> },
  ];

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/overview")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { metrics: typeof fallbackMetrics; recentCompanies: AdminCompany[] }) => {
        if (!cancelled) {
          setMetrics(data.metrics);
          setRecent(data.recentCompanies);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMetrics(fallbackMetrics);
          setRecent([...COMPANIES].slice(0, 4));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="text-[21px] font-semibold text-head m-0">Platform overview</h1>
      <p className="mt-1 mb-5 text-muted text-[13px]">JewelHire internal — across every company.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-[18px]">
        {stats.map((x) => (
          <div key={x.k} className="bg-panel border border-line rounded px-4 py-[15px]">
            <div className="flex items-center gap-1.5 text-xs text-muted font-medium"><span className="text-primary">{x.icon}</span>{x.k}</div>
            <div className="text-2xl font-semibold text-head mt-1.5 leading-none">{x.v}</div>
            <div className="text-xs mt-1.5 text-muted">{x.s}</div>
          </div>
        ))}
      </div>

      <Panel title="Companies" action={<Link href="/admin/companies" className="text-[12.5px] text-primary no-underline">View all</Link>}>
        <div className="overflow-x-auto"><table className="w-full border-collapse">
          <thead>
            <tr>{["Company", "Plan", "Stores", "Status", ""].map((h) => <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>)}</tr>
          </thead>
          <tbody>
            {recent.map((c) => (
              <tr key={c.id} className="hover:bg-rowhover">
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><Link href={`/admin/companies/${c.id}`} className="font-medium text-head no-underline hover:text-primary">{c.name}</Link><div className="text-[11.5px] text-muted">{c.owner}</div></td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${PLAN_STYLE[c.plan]}`}>{c.plan}</span></td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">{c.stores.length}</td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[c.status]}`}>{c.status}</span></td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><Link href={`/admin/companies/${c.id}`} className="text-muted hover:text-primary"><IconChevronRight size={16} /></Link></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Panel>
    </div>
  );
}
