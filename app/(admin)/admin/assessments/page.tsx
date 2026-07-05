"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui";
import { IconClipboardList, IconDiamond, IconPlus, IconCheck, IconX } from "@/components/icons";
import type { AdminAssessmentDefault } from "@/lib/local-admin-store";

const LIBRARY: AdminAssessmentDefault[] = [
  { id: "gemmatch", name: "JewelCert", kind: "Trait profile", scope: "All plans", status: "Published", questions: 48, note: "The core pick-10 profile. Default for every company.", origin: "builtin" },
  { id: "12-essentials-understanding-your", name: "12 Essentials: Understanding your potential", kind: "Trait profile", scope: "All plans", status: "Published", questions: 36, note: "Migrated from the legacy Bubble system.", origin: "legacy" },
  { id: "sales-personality-profiling-test", name: "Sales Personality Profiling Test", kind: "Trait profile", scope: "All plans", status: "Published", questions: 24, note: "Migrated from the legacy Bubble system.", origin: "legacy" },
  { id: "jewelry-basic-knowledge", name: "Jewelry Basic Knowledge Assessment", kind: "Knowledge check", scope: "All plans", status: "Published", questions: 22, note: "Migrated from the legacy Bubble system.", origin: "legacy" },
];

const STATUS: Record<string, string> = { Published: "bg-[#e1f5ee] text-[#0f6e56]", Draft: "bg-[#fff4e2] text-[#9a6a12]" };
const ORIGIN: Record<string, { label: string; className: string }> = {
  builtin: { label: "Built-in", className: "bg-[#e8f1ff] text-primary" },
  legacy: { label: "Legacy", className: "bg-[#efe9fd] text-[#5a44c9]" },
  custom: { label: "Custom", className: "bg-[#fff1e8] text-[#b45309]" },
};

export default function AdminAssessmentsPage() {
  const [library, setLibrary] = useState<AdminAssessmentDefault[]>(LIBRARY);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    fetch("/api/admin/assessments")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { items: AdminAssessmentDefault[] }) => setLibrary(data.items))
      .catch(() => setLibrary(LIBRARY));
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/assessments")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { items: AdminAssessmentDefault[] }) => {
        if (!cancelled) setLibrary(data.items);
      })
      .catch(() => {
        if (!cancelled) setLibrary(LIBRARY);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const togglePublish = async (a: AdminAssessmentDefault) => {
    setBusyId(a.id);
    const next = a.status === "Published" ? "Draft" : "Published";
    // optimistic
    setLibrary((list) => list.map((x) => (x.id === a.id ? { ...x, status: next } : x)));
    try {
      const r = await fetch(`/api/admin/assessments/${a.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!r.ok) throw new Error();
    } catch {
      load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (a: AdminAssessmentDefault) => {
    if (!confirm(`Delete "${a.name}"? Stores will no longer see it as a default.`)) return;
    setBusyId(a.id);
    setLibrary((list) => list.filter((x) => x.id !== a.id));
    try {
      const r = await fetch(`/api/admin/assessments/${a.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
    } catch {
      load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-[18px]">
        <div>
          <h1 className="text-[21px] font-semibold text-head m-0">Assessment library</h1>
          <p className="mt-1 mb-0 text-muted text-[13px]">Default, admin-created assessments every company builds on. Stores can send these or create their own.</p>
        </div>
        <Link href="/admin/assessments/new" className="btn-grad inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] no-underline"><IconPlus size={16} /> New default</Link>
      </div>

      <Panel title="Defaults" icon={<IconClipboardList size={16} />}>
        <div className="overflow-x-auto"><table className="w-full border-collapse">
          <thead><tr>{["Assessment", "Type", "Origin", "Questions", "Available to", "Status", ""].map((h) => <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>)}</tr></thead>
          <tbody>
            {library.map((a) => {
              const origin = ORIGIN[a.origin] ?? ORIGIN.custom;
              const protectedRow = a.id === "gemmatch";
              return (
                <tr key={a.id} className="hover:bg-rowhover align-top">
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                    <div className="flex items-center gap-2">{protectedRow && <IconDiamond size={15} className="text-primary" />}<span className="font-medium text-head">{a.name}</span></div>
                    <div className="text-[12px] text-muted mt-0.5 max-w-[380px]">{a.note}</div>
                  </td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><span className="inline-flex px-2.5 py-1 rounded-md text-[11.5px] font-semibold bg-[#e8f1ff] text-primary">{a.kind}</span></td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium ${origin.className}`}>{origin.label}</span></td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">{a.questions}</td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[12.5px] text-body">{a.scope}</td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                    <button onClick={() => togglePublish(a)} disabled={busyId === a.id} title="Toggle published" className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full disabled:opacity-50 ${STATUS[a.status]}`}>{a.status === "Published" && <IconCheck size={11} />}{a.status}</button>
                  </td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] text-right">
                    {!protectedRow && (
                      <button onClick={() => remove(a)} disabled={busyId === a.id} className="text-muted hover:text-[#a32d2d] disabled:opacity-50 inline-flex items-center" title="Delete"><IconX size={15} /></button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </Panel>
    </div>
  );
}
