"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui";
import { IconClipboardList, IconDiamond, IconPlus, IconCheck } from "@/components/icons";
import type { AdminAssessmentDefault } from "@/lib/local-admin-store";

const LIBRARY = [
  { id: "gemmatch", name: "GemMatch", kind: "Trait profile", scope: "All plans", status: "Published", questions: 48, note: "The core pick-10 profile. Default for every company." },
  { id: "apt-num", name: "Numerical Reasoning", kind: "Aptitude", scope: "Growth & Pro", status: "Published", questions: 20, note: "Legacy aptitude battery, seeded for v2." },
  { id: "know-diamond", name: "Diamond Knowledge", kind: "Knowledge check", scope: "All plans", status: "Published", questions: 15, note: "4Cs and grading fundamentals." },
  { id: "pers-sales", name: "Sales Personality", kind: "Trait profile", scope: "Pro", status: "Draft", questions: 30, note: "Extended selling-style inventory." },
];

const STATUS = { Published: "bg-[#e1f5ee] text-[#0f6e56]", Draft: "bg-[#fff4e2] text-[#9a6a12]" } as Record<string, string>;

export default function AdminAssessmentsPage() {
  const [library, setLibrary] = useState<AdminAssessmentDefault[]>(LIBRARY as AdminAssessmentDefault[]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/assessments")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { items: AdminAssessmentDefault[] }) => {
        if (!cancelled) setLibrary(data.items);
      })
      .catch(() => {
        if (!cancelled) setLibrary(LIBRARY as AdminAssessmentDefault[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="flex items-end justify-between mb-[18px]">
        <div>
          <h1 className="text-[21px] font-semibold text-head m-0">Assessment library</h1>
          <p className="mt-1 mb-0 text-muted text-[13px]">Default, admin-created assessments every company builds on.</p>
        </div>
        <Link href="/assessments/new" className="btn-grad inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] no-underline"><IconPlus size={16} /> New default</Link>
      </div>

      <Panel title="Defaults" icon={<IconClipboardList size={16} />}>
        <div className="overflow-x-auto"><table className="w-full border-collapse">
          <thead><tr>{["Assessment", "Type", "Questions", "Available to", "Status"].map((h) => <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>)}</tr></thead>
          <tbody>
            {library.map((a) => (
              <tr key={a.id} className="hover:bg-rowhover align-top">
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                  <div className="flex items-center gap-2">{a.id === "gemmatch" && <IconDiamond size={15} className="text-primary" />}<span className="font-medium text-head">{a.name}</span></div>
                  <div className="text-[12px] text-muted mt-0.5 max-w-[380px]">{a.note}</div>
                </td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><span className="inline-flex px-2.5 py-1 rounded-md text-[11.5px] font-semibold bg-[#e8f1ff] text-primary">{a.kind}</span></td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">{a.questions}</td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[12.5px] text-body">{a.scope}</td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full ${STATUS[a.status]}`}>{a.status === "Published" && <IconCheck size={11} />}{a.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Panel>
    </div>
  );
}
