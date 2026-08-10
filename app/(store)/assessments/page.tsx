"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common";
import { Panel } from "@/components/ui";
import { LEGACY_ASSESSMENTS } from "@/lib/legacy";
import { AssessmentResult, COMPLETED_RESULTS } from "@/lib/assessment-results";
import { CustomAssessment, CUSTOM_ASSESSMENTS } from "@/lib/custom-assessments";
import { GEMMATCH_PERSONALITY_ASSESSMENT_LABEL } from "@/lib/jewelcert";
import { IconPlus, IconClipboardList, IconDiamond } from "@/components/icons";
import { useActiveStoreId } from "@/lib/client-session";

// A default assessment from the platform catalog (JewelCert + admin/legacy tests).
interface DefaultAssessment {
  id: string;
  title: string;
  type: string;
  durationMinutes?: number;
  questionCount: number;
  owner: string;
  status: string;
}

const DEFAULT_LIBRARY_FALLBACK: DefaultAssessment[] = [
  { id: "gemmatch", title: GEMMATCH_PERSONALITY_ASSESSMENT_LABEL, type: "Trait profile", durationMinutes: 3, questionCount: 48, owner: "Admin", status: "Published" },
  ...LEGACY_ASSESSMENTS.map((a) => ({
    id: a.title,
    title: a.title,
    type: a.type,
    durationMinutes: a.durationMinutes,
    questionCount: a.questionCount,
    owner: "Admin",
    status: "Published",
  })),
];

export default function Page() {
  const STORE_ID = useActiveStoreId("store-sissys-little-rock");
  const [customAssessments, setCustomAssessments] = useState<CustomAssessment[]>([]);
  const [completedResults, setCompletedResults] = useState<AssessmentResult[]>([]);
  const [defaultLibrary, setDefaultLibrary] = useState<DefaultAssessment[]>(DEFAULT_LIBRARY_FALLBACK);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/assessments").then((response) => (response.ok ? response.json() : Promise.reject())),
      fetch(`/api/stores/${STORE_ID}/assessments`).then((response) => (response.ok ? response.json() : Promise.reject())),
      fetch(`/api/stores/${STORE_ID}/assessment-results`).then((response) => (response.ok ? response.json() : Promise.reject())),
    ])
      .then(([catalog, storeAssessments, results]) => {
        if (cancelled) return;
        setDefaultLibrary((catalog.items || []).filter((item: DefaultAssessment) => item.title));
        setCustomAssessments(storeAssessments.items);
        setCompletedResults(results.items);
      })
      .catch(() => {
        if (!cancelled) setDefaultLibrary(DEFAULT_LIBRARY_FALLBACK);
      });
    return () => {
      cancelled = true;
    };
  }, [STORE_ID]);

  const typeChip = (type: string) =>
    type === "Knowledge check" ? "bg-[#e1f5ee] text-[#0f6e56]" : "bg-[#e8f1ff] text-primary";

  return (
    <div>
      <PageHeader
        title="Assessments"
        subtitle="Send the default JewelCert library, or build your own store-specific assessments."
        action={
          <Link href="/assessments/new" className="btn-grad inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] no-underline">
            <IconPlus size={16} /> Build assessment
          </Link>
        }
      />

      {/* Group 1 — the store's own custom assessments. */}
      <Panel
        title="Your custom assessments"
        icon={<IconClipboardList size={16} />}
        className="mb-[18px]"
        action={<Link href="/assessments/new" className="text-[12.5px] text-primary no-underline">New</Link>}
      >
        {customAssessments.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted text-[13px]">No custom assessments yet. <Link href="/assessments/new" className="text-primary no-underline">Build your first →</Link></div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full border-collapse">
            <thead>
              <tr>
                {["Assessment", "Type", "Questions", "Status"].map((h) => (
                  <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customAssessments.map((a) => (
                <tr key={a.id} className="hover:bg-rowhover align-top">
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                    <div className="font-medium text-head">{a.title}</div>
                    <div className="text-[12px] text-muted mt-1 max-w-[420px]">{a.description}</div>
                  </td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-[11.5px] font-semibold ${typeChip(a.kind)}`}>{a.kind}</span>
                  </td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">{a.questions.length}</td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                    <span className={`inline-flex text-[11.5px] font-medium px-2.5 py-1 rounded-full ${a.status === "Published" ? "bg-[#e1f5ee] text-[#0f6e56]" : "bg-[#fff4e2] text-[#9a6a12]"}`}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Panel>

      {/* Group 2 — the platform defaults every store can send. */}
      <Panel
        title="Default library"
        icon={<IconDiamond size={16} />}
        className="mb-[18px]"
        action={<span className="text-[11.5px] text-muted">Included with your plan · read-only</span>}
      >
        <div className="overflow-x-auto"><table className="w-full border-collapse">
          <thead>
            <tr>
              {["Assessment", "Type", "Duration", "Questions"].map((h) => (
                <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {defaultLibrary.map((a) => (
              <tr key={a.id} className="hover:bg-rowhover align-top">
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                  <div className="flex items-center gap-2">{a.id === "gemmatch" && <IconDiamond size={14} className="text-primary" />}<span className="font-medium text-head">{a.title}</span></div>
                </td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                  <span className={`inline-flex px-2.5 py-1 rounded-md text-[11.5px] font-semibold ${typeChip(a.type)}`}>{a.type}</span>
                </td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] text-muted">{a.durationMinutes ? `${a.durationMinutes} min` : "—"}</td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">{a.questionCount}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Panel>

      <Panel title="Completed results — manager review">
        <div className="overflow-x-auto"><table className="w-full border-collapse">
          <thead>
            <tr>
              {["Candidate", "Assessment", "Type", "Result", "Status", ""].map((h) => (
                <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {completedResults.map((r) => (
              <tr key={r.slug} className="hover:bg-rowhover">
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-[28px] h-[28px] rounded-full bg-[#e8f1ff] flex items-center justify-center text-[11px] font-bold text-primary">{r.candidate.initials}</span>
                    <span className="font-medium text-head">{r.candidate.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">{r.title}</td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                  <span className={`inline-flex px-2.5 py-1 rounded-md text-[11.5px] font-semibold ${r.type === "knowledge_check" ? "bg-[#e1f5ee] text-[#0f6e56]" : "bg-[#e8f1ff] text-primary"}`}>
                    {r.type === "knowledge_check" ? "Knowledge check" : "Trait profile"}
                  </span>
                </td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] font-medium text-head">
                  {r.type === "knowledge_check" ? `${r.totalScore}/100` : r.scoreLabel}
                </td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                  <span className="inline-flex text-[11.5px] font-medium px-2.5 py-1 rounded-full bg-[#fff4e2] text-[#9a6a12]">{r.status}</span>
                </td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                  <Link href={`/assessments/${r.slug}/review/${r.candidate.id}`} className="text-primary no-underline font-medium">Review →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Panel>
    </div>
  );
}
