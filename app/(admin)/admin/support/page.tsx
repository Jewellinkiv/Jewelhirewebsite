"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui";
import { AUDIT_LOG, COMPANIES, AdminCompany, AuditEntry, STATUS_STYLE } from "@/lib/admin";
import { IconSearch, IconUser, IconBriefcase, IconChevronRight, IconClock } from "@/components/icons";

const input = "border border-line rounded-md px-3 py-2 text-[13px] text-body outline-none focus:border-primary bg-white w-full";

export default function SupportPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AdminCompany[]>(COMPANIES);
  const [audit, setAudit] = useState<AuditEntry[]>(AUDIT_LOG);

  useEffect(() => {
    let cancelled = false;
    const search = encodeURIComponent(q);
    fetch(`/api/admin/support${search ? `?q=${search}` : ""}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { companies: AdminCompany[]; auditLog: AuditEntry[] }) => {
        if (!cancelled) {
          setResults(data.companies);
          setAudit(data.auditLog);
        }
      })
      .catch(() => {
        if (!cancelled) {
          const fallback = q
            ? COMPANIES.filter((company) => company.name.toLowerCase().includes(q.toLowerCase()) || company.owner.toLowerCase().includes(q.toLowerCase()))
            : COMPANIES;
          setResults(fallback);
          setAudit(AUDIT_LOG);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [q]);

  return (
    <div className="max-w-[920px]">
      <h1 className="text-[21px] font-semibold text-head m-0">Support</h1>
      <p className="mt-1 mb-5 text-muted text-[13px]">Find a company, view as them to debug, and review the audit trail.</p>

      <div className="relative mb-3 max-w-[380px]">
        <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className={`${input} pl-9`} placeholder="Search by company or owner…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Panel title={`Companies (${results.length})`} className="mb-[18px]">
        <div className="divide-y divide-[#eef1f6]">
          {results.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-8 h-8 rounded-md bg-[#e8f1ff] text-primary flex items-center justify-center"><IconBriefcase size={15} /></span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-head">{c.name}</div>
                <div className="text-[11.5px] text-muted">{c.owner} · {c.stores.length} store{c.stores.length === 1 ? "" : "s"}</div>
              </div>
              <span className={`ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[c.status]}`}>{c.status}</span>
              <Link href={`/admin/companies/${c.id}`} className="inline-flex items-center gap-1 text-[12px] text-primary no-underline"><IconUser size={13} /> View as <IconChevronRight size={13} /></Link>
            </div>
          ))}
          {results.length === 0 && <div className="px-4 py-8 text-center text-muted text-[13px]">No companies match.</div>}
        </div>
      </Panel>

      <Panel title="Audit log" icon={<IconClock size={16} />}>
        <div className="divide-y divide-[#eef1f6]">
          {audit.map((a) => (
            <div key={a.id} className="flex items-center gap-2 px-4 py-2.5 text-[12.5px]">
              <span className="font-medium text-head capitalize">{a.actor}</span>
              <span className="text-muted">{a.action}</span>
              <span className="text-body">{a.target}</span>
              <span className="ml-auto text-[11px] text-muted">{a.at}</span>
            </div>
          ))}
          {audit.length === 0 && <div className="px-4 py-8 text-center text-muted text-[13px]">No activity yet.</div>}
        </div>
      </Panel>
    </div>
  );
}
