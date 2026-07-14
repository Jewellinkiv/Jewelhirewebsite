"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui";
import { COMPANIES, AdminCompany, PlanTier, STATUS_STYLE, PLAN_STYLE } from "@/lib/admin";
import { IconBriefcase, IconPlus, IconX, IconSearch, IconChevronRight, IconCheck } from "@/components/icons";

const input = "border border-line rounded-md px-3 py-2 text-[13px] text-body outline-none focus:border-primary bg-white w-full";

export default function CompaniesPage() {
  const [list, setList] = useState<AdminCompany[]>(COMPANIES);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [teamInvitesEnabled, setTeamInvitesEnabled] = useState(false);

  const filtered = list.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.owner.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/companies")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { items: AdminCompany[]; capabilities?: { teamInvitesEnabled?: boolean } }) => {
        if (!cancelled) {
          setList(data.items);
          setTeamInvitesEnabled(data.capabilities?.teamInvitesEnabled === true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setList(COMPANIES);
          setTeamInvitesEnabled(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const addCompany = async (name: string, owner: string, plan: PlanTier) => {
    if (!teamInvitesEnabled) {
      setNotice("Company creation is paused while JewelHire completes secure owner invitations.");
      setNoticeIsError(true);
      return;
    }
    const response = await fetch("/api/admin/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, owner, plan }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setNotice(body?.error?.message || "The company could not be created.");
      setNoticeIsError(true);
      return;
    }
    const data = await response.json() as { company: AdminCompany };
    setList((l) => [data.company, ...l.filter((company) => company.id !== data.company.id)]);
    setNotice(`${data.company.name} created on the ${data.company.plan} plan.`);
    setNoticeIsError(false);
    setOpen(false);
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-[18px]">
        <div>
          <h1 className="text-[21px] font-semibold text-head m-0">Companies</h1>
          <p className="mt-1 mb-0 text-muted text-[13px]">{list.length} companies on the platform.</p>
        </div>
        <button disabled={!teamInvitesEnabled} onClick={() => setOpen(true)} className="btn-grad inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"><IconPlus size={16} /> {teamInvitesEnabled ? "New company" : "Creation paused"}</button>
      </div>

      {!teamInvitesEnabled && (
        <div className="mb-4 rounded-md border border-[#cfe0fb] bg-[#eef4ff] px-3.5 py-2.5 text-[12.5px] text-body">
          <span className="font-medium text-head">Pilot safety control:</span> company creation is paused because secure owner invitation acceptance is not enabled yet. Existing companies remain available.
        </div>
      )}

      {notice && (
        <div className={`mb-4 flex items-center gap-2 rounded-md px-3.5 py-2.5 text-[13px] ${noticeIsError ? "bg-[#fff4e2] border border-[#f1ddb6] text-[#7a5610]" : "bg-[#e1f5ee] border border-[#cdeadd] text-[#0f6e56]"}`}>
          <IconCheck size={15} /> {notice}<button onClick={() => setNotice("")} className="ml-auto"><IconX size={15} /></button>
        </div>
      )}

      <div className="relative mb-3 max-w-[320px]">
        <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className={`${input} pl-9`} placeholder="Search companies…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Panel>
        <div className="overflow-x-auto"><table className="w-full border-collapse">
          <thead>
            <tr>{["Company", "Owner", "Plan", "Stores", "Status", ""].map((h) => <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-rowhover">
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><Link href={`/admin/companies/${c.id}`} className="flex items-center gap-2.5 no-underline"><span className="w-8 h-8 rounded-md bg-[#e8f1ff] text-primary flex items-center justify-center"><IconBriefcase size={15} /></span><span className="font-medium text-head">{c.name}</span></Link></td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">{c.owner}</td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${PLAN_STYLE[c.plan]}`}>{c.plan}</span></td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">{c.stores.length}</td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[c.status]}`}>{c.status}</span></td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><Link href={`/admin/companies/${c.id}`} className="text-muted hover:text-primary"><IconChevronRight size={16} /></Link></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted text-[13px]">No companies match.</td></tr>}
          </tbody>
        </table></div>
      </Panel>

      {open && <NewCompanyModal onClose={() => setOpen(false)} onCreate={addCompany} />}
    </div>
  );
}

function NewCompanyModal({ onClose, onCreate }: { onClose: () => void; onCreate: (n: string, o: string, p: PlanTier) => void }) {
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [plan, setPlan] = useState<PlanTier>("Starter");
  const ok = name.trim() && owner.trim();

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-[460px] my-12 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <h3 className="m-0 text-[15px] font-semibold text-head">New company</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-md text-muted hover:bg-rowhover flex items-center justify-center"><IconX size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex flex-col"><label className="text-[11.5px] font-medium text-head mb-1">Company name</label><input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maple & Stone Jewelers" /></div>
          <div className="flex flex-col"><label className="text-[11.5px] font-medium text-head mb-1">Owner name</label><input className={input} value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Account owner" /></div>
          <div className="flex flex-col"><label className="text-[11.5px] font-medium text-head mb-1">Plan</label><select className={input} value={plan} onChange={(e) => setPlan(e.target.value as PlanTier)}>{(["Starter", "Growth", "Pro"] as PlanTier[]).map((p) => <option key={p}>{p}</option>)}</select></div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-line">
          <button onClick={onClose} className="px-4 py-2 text-[13px] rounded-md border border-line text-body hover:bg-rowhover">Cancel</button>
          <button onClick={() => ok && onCreate(name.trim(), owner.trim(), plan)} disabled={!ok} className={`px-4 py-2 text-[13px] ${ok ? "btn-grad" : "rounded-md bg-[#cfd6e0] text-white cursor-not-allowed"}`}>Create company</button>
        </div>
      </div>
    </div>
  );
}
