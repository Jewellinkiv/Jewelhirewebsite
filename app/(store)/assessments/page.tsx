"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common";
import { Panel } from "@/components/ui";
import { LEGACY_ASSESSMENTS } from "@/lib/legacy";
import { AssessmentResult, COMPLETED_RESULTS } from "@/lib/assessment-results";
import { CustomAssessment, CUSTOM_ASSESSMENTS } from "@/lib/custom-assessments";
import { IconPlus, IconClipboardList } from "@/components/icons";

export default function Page() {
  const [customAssessments, setCustomAssessments] = useState<CustomAssessment[]>(CUSTOM_ASSESSMENTS);
  const [completedResults, setCompletedResults] = useState<AssessmentResult[]>(COMPLETED_RESULTS);
  const [legacyAssessments, setLegacyAssessments] = useState(LEGACY_ASSESSMENTS);
  const totalQuestions = legacyAssessments.reduce((sum, a) => sum + a.questionCount, 0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/assessments").then((response) => (response.ok ? response.json() : Promise.reject())),
      fetch("/api/stores/store-sissys-little-rock/assessments").then((response) => (response.ok ? response.json() : Promise.reject())),
      fetch("/api/stores/store-sissys-little-rock/assessment-results").then((response) => (response.ok ? response.json() : Promise.reject())),
    ])
      .then(([catalog, storeAssessments, results]) => {
        if (cancelled) return;
        setLegacyAssessments(catalog.items.filter((item: any) => item.title && item.title !== "GemMatch"));
        setCustomAssessments(storeAssessments.items);
        setCompletedResults(results.items);
      })
      .catch(() => {
        if (!cancelled) {
          setLegacyAssessments(LEGACY_ASSESSMENTS);
          setCustomAssessments(CUSTOM_ASSESSMENTS);
          setCompletedResults(COMPLETED_RESULTS);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Assessments"
        subtitle="Your own assessments, the default GemMatch + admin tests, and completed results."
        action={
          <Link href="/assessments/new" className="btn-grad inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] no-underline">
            <IconPlus size={16} /> Build assessment
          </Link>
        }
      />

      <Panel
        title="Your assessments"
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
                {["Assessment", "Type", "Owner", "Questions", "Status"].map((h) => (
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
                    <span className="inline-flex px-2.5 py-1 rounded-md text-[11.5px] font-semibold bg-[#e8f1ff] text-primary">{a.kind}</span>
                  </td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${a.owner === "Store" ? "bg-[#efe9fd] text-[#5a44c9]" : "bg-[#eef2f7] text-[#5b6472]"}`}>{a.owner}</span>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-[18px]">
        {[
          { k: "Legacy tests", v: legacyAssessments.length, s: "Bubble admin inventory" },
          { k: "Questions", v: totalQuestions, s: "Documented with scoring" },
          { k: "Trait profiles", v: legacyAssessments.filter((a) => a.type === "Trait profile").length, s: "Candidate style/fit" },
          { k: "Knowledge checks", v: legacyAssessments.filter((a) => a.type === "Knowledge check").length, s: "Answer-key scoring" },
        ].map((x) => (
          <div key={x.k} className="bg-panel border border-line rounded px-4 py-[15px]">
            <div className="text-xs text-muted font-medium">{x.k}</div>
            <div className="text-2xl font-semibold text-head mt-[5px] leading-none">{x.v}</div>
            <div className="text-xs mt-[5px] text-muted">{x.s}</div>
          </div>
        ))}
      </div>

      <Panel title="Completed results — manager review" className="mb-[18px]">
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

      <Panel title="Legacy aptitude tests">
        <div className="overflow-x-auto"><table className="w-full border-collapse">
          <thead>
            <tr>
              {["Assessment", "Type", "Duration", "Questions", "Targets", "Media"].map((h) => (
                <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {legacyAssessments.map((a) => (
              <tr key={a.title} className="hover:bg-rowhover align-top">
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                  <div className="font-medium text-head">{a.title}</div>
                  <div className="text-[12px] text-muted mt-1 max-w-[360px]">{a.migrationNote}</div>
                </td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                  <span className={`inline-flex px-2.5 py-1 rounded-md text-[11.5px] font-semibold ${a.type === "Knowledge check" ? "bg-[#e1f5ee] text-[#0f6e56]" : "bg-[#e8f1ff] text-primary"}`}>
                    {a.type}
                  </span>
                </td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">{a.durationMinutes} min</td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">{a.questionCount}</td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[12.5px] text-body max-w-[300px]">
                  {a.targets.join(", ")}
                </td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[12.5px] text-muted">
                  {a.media.join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Panel>
    </div>
  );
}
