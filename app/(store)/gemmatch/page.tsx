"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common";
import { Panel, FitBadge, TypeLabel } from "@/components/ui";
import { GEMMATCH_SENT, SendStatus } from "@/lib/gemmatch-sent";
import { IconSend } from "@/components/icons";

const STATUS_STYLE: Record<SendStatus, string> = {
  Sent: "bg-[#fff4e2] text-[#9a6a12]",
  Started: "bg-[#e8f1ff] text-primary",
  Completed: "bg-[#dff3e8] text-[#0f6e56]",
};

type GemMatchRow = (typeof GEMMATCH_SENT)[number];
const STORE_ID = "store-sissys-little-rock";

export default function GemMatchSentPage() {
  const [status, setStatus] = useState<SendStatus | "All">("All");
  const [allRows, setAllRows] = useState<GemMatchRow[]>(GEMMATCH_SENT);
  const rows = allRows.filter((r) => status === "All" || r.status === status);
  const count = (s: SendStatus) => allRows.filter((r) => r.status === s).length;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stores/${STORE_ID}/gemmatch-invites`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: {
        items: {
          applicant: { id: string; name: string; initials: string; role: string } | null;
          sentDate: string;
          status: SendStatus;
          type?: string;
          primary?: GemMatchRow["primary"];
          fitScore?: number;
          fitTier?: GemMatchRow["fitTier"];
        }[];
      }) => {
        if (!cancelled) {
          setAllRows(data.items.map((item) => ({
            id: item.applicant?.id || "unknown",
            name: item.applicant?.name || "Unknown applicant",
            initials: item.applicant?.initials || "NA",
            role: item.applicant?.role || "Jewelry role",
            sentDate: item.sentDate,
            status: item.status,
            type: item.type,
            primary: item.primary,
            fitScore: item.fitScore,
            fitTier: item.fitTier,
          })));
        }
      })
      .catch(() => {
        if (!cancelled) setAllRows(GEMMATCH_SENT);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="GemMatch"
        subtitle="Applicants you've sent GemMatch to, their status, and the resulting fit."
        action={<Link href="/send-jewelcert" className="btn-grad inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] no-underline"><IconSend size={16} /> Send JewelCert</Link>}
      />

      <div className="flex flex-wrap gap-1.5 mb-4">
        {(["All", "Sent", "Started", "Completed"] as const).map((s) => {
          const n = s === "All" ? allRows.length : count(s as SendStatus);
          return (
            <button key={s} onClick={() => setStatus(s)} className={`inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-md border ${status === s ? "bg-[#e8f1ff] border-primary text-primary font-medium" : "bg-panel border-line text-body hover:bg-rowhover"}`}>
              {s}<span className={`text-[11px] rounded-full px-1.5 ${status === s ? "bg-[#d7e6ff]" : "bg-[#eef2f7] text-muted"}`}>{n}</span>
            </button>
          );
        })}
        <span className="text-[12.5px] text-muted ml-auto self-center">{rows.length} of {allRows.length}</span>
      </div>

      <Panel title="Sent GemMatch">
        <div className="overflow-x-auto"><table className="w-full border-collapse">
          <thead>
            <tr>
              {["Applicant", "Role", "Sent", "Status", "Type", "Fit"].map((h) => (
                <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-rowhover">
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                  <Link href={`/applicants/${r.id}`} className="flex items-center gap-2.5 no-underline">
                    <span className="w-[30px] h-[30px] rounded-full bg-[#e8f1ff] flex items-center justify-center text-[11px] font-bold text-primary">{r.initials}</span>
                    <span className="font-medium text-head">{r.name}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">{r.role}</td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] text-muted">{r.sentDate}</td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><span className={`inline-flex text-[11.5px] font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[r.status]}`}>{r.status}</span></td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                  {r.type && r.primary ? <TypeLabel primary={r.primary} type={r.type} /> : <span className="text-muted">—</span>}
                </td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                  {r.fitScore != null && r.fitTier ? <FitBadge score={r.fitScore} tier={r.fitTier} /> : <span className="text-muted">—</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted text-[13px]">None match.</td></tr>}
          </tbody>
        </table></div>
      </Panel>
    </div>
  );
}
