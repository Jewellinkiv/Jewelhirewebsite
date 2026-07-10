"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common";
import { Panel, FitBadge, TypeLabel } from "@/components/ui";
import { STAGES, Stage, JewelCertStatus, PipelineApplicant } from "@/lib/pipeline";
import { IconSend, IconCalendar, IconUserPlus, IconFileText, IconSearch, IconChevronRight } from "@/components/icons";
import { FitTier, ProfileCode } from "@/lib/gemmatch";

const STAGE_STYLE: Record<Stage, string> = {
  Applied: "bg-[#eef2f7] text-[#5b6472]",
  JewelCert: "bg-[#fff4e2] text-[#9a6a12]",
  GemMatch: "bg-[#e8f1ff] text-primary",
  Interview: "bg-[#e1f5ee] text-[#0f6e56]",
  Hired: "bg-[#dff3e8] text-[#0f6e56]",
  Rejected: "bg-[#fcebeb] text-[#a32d2d]",
};

function JewelCert({ status, score }: { status: JewelCertStatus; score?: number }) {
  const map: Record<JewelCertStatus, string> = {
    "Not sent": "bg-[#eef2f7] text-[#5b6472]",
    Sent: "bg-[#fff4e2] text-[#9a6a12]",
    Completed: "bg-[#e8f1ff] text-primary",
    Passed: "bg-[#dff3e8] text-[#0f6e56]",
    Flagged: "bg-[#fcebeb] text-[#a32d2d]",
  };
  const label =
    status === "Not sent" || status === "Sent" ? status :
    status === "Completed" ? (score === undefined ? "Completed" : `${score}`) :
    score === undefined ? status : `${status} · ${score}`;
  return <span className={`inline-flex text-[11.5px] font-semibold px-2.5 py-1 rounded-md ${map[status]}`}>{label}</span>;
}

type ApiStage = "applied" | "jewelcert" | "gemmatch" | "interview" | "offer" | "hired" | "rejected" | "withdrawn";
type ApiApplicationItem = {
  application: { id: string; stage: ApiStage; lastActivityAt: string; submittedAt: string };
  applicant?: { fullName: string; location: string };
  job?: { title: string };
  screening: {
    jewelcertStatus: "not_sent" | "sent" | "started" | "completed" | "expired" | "cancelled";
    gemmatchProfile?: ProfileCode;
    gemmatchFit?: string;
  };
  nextInterview?: { startsAt: string };
  noteCount: number;
};

const STAGE_FROM_API: Record<ApiStage, Stage> = {
  applied: "Applied",
  jewelcert: "JewelCert",
  gemmatch: "GemMatch",
  interview: "Interview",
  offer: "Interview",
  hired: "Hired",
  rejected: "Rejected",
  withdrawn: "Rejected",
};

function stageLabel(stage: Stage) {
  return stage === "GemMatch" ? "JewelCert profile" : stage;
}

function initials(name: string) {
  return name.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase() || "NA";
}

function relativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toPipelineApplicant(item: ApiApplicationItem): PipelineApplicant {
  const name = item.applicant?.fullName || "Applicant";
  const profile = item.screening.gemmatchProfile;
  return {
    // Application id — unique, and the applicant/hire routes resolve it. A
    // name slug collides when two applicants share a name.
    id: item.application.id,
    name,
    initials: initials(name),
    role: item.job?.title || "Jewelry role",
    location: item.applicant?.location || "—",
    stage: STAGE_FROM_API[item.application.stage],
    jewelcert: {
      status:
        item.screening.jewelcertStatus === "not_sent"
          ? "Not sent"
          : item.screening.jewelcertStatus === "completed"
            ? "Completed"
            : "Sent",
    },
    gemmatch: profile
      ? {
          type: profile === "C" ? "Luxury Advisor" : profile === "F" ? "Master Craftsman" : profile === "D" ? "Sales Strategist" : "Trailblazer",
          primary: profile,
          fitScore: item.screening.gemmatchFit === "Strong fit" ? 88 : item.screening.gemmatchFit === "Poor fit" ? 32 : 74,
          tier: (item.screening.gemmatchFit as FitTier) || "Good fit",
        }
      : undefined,
    notes: item.noteCount,
    lastActivity: relativeDate(item.application.lastActivityAt || item.application.submittedAt),
    interviewAt: item.nextInterview ? relativeDate(item.nextInterview.startsAt) : undefined,
  };
}

export default function PipelinePage() {
  // Start empty (never seed demo rows — a slow fetch showed fake applicants).
  const [apiRows, setApiRows] = useState<PipelineApplicant[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<Stage | "All">("All");
  const [cert, setCert] = useState<JewelCertStatus | "All">("All");
  const [fit, setFit] = useState<string>("All");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/store/applications")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Unable to load pipeline"))))
      .then((body) => {
        if (cancelled) return;
        setApiRows((body.items || []).map(toPipelineApplicant));
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    return apiRows.filter((a) => {
      if (stage !== "All" && a.stage !== stage) return false;
      if (cert !== "All" && a.jewelcert.status !== cert) return false;
      if (fit !== "All" && a.gemmatch?.tier !== fit) return false;
      if (q && !(`${a.name} ${a.role}`.toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
  }, [apiRows, q, stage, cert, fit]);

  const count = (s: Stage) => apiRows.filter((a) => a.stage === s).length;
  const selectCls = "border border-line rounded-md bg-panel text-[13px] text-body px-2.5 py-2 outline-none focus:border-primary";

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle="Your store's applicants — filter by stage and JewelCert, take notes, schedule interviews, hire to JewelLink."
        action={
          <Link href="/send-jewelcert" className="btn-grad inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] no-underline">
            <IconSend size={16} /> Send JewelCert
          </Link>
        }
      />

      {/* stage segmented filter */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <StageChip label="All" n={apiRows.length} active={stage === "All"} onClick={() => setStage("All")} />
        {STAGES.map((s) => (
          <StageChip key={s} label={stageLabel(s)} n={count(s)} active={stage === s} onClick={() => setStage(s)} />
        ))}
      </div>

      {/* filters row */}
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <div className="flex items-center gap-2 bg-panel border border-line rounded-md px-3 py-2 min-w-[220px] flex-1 max-w-[320px]">
          <IconSearch size={16} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search applicants…" className="bg-transparent outline-none text-[13px] w-full text-body" />
        </div>
        <select className={selectCls} value={cert} onChange={(e) => setCert(e.target.value as JewelCertStatus | "All")}>
          <option value="All">JewelCert: all</option>
          {(["Not sent", "Sent", "Completed"] as JewelCertStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={selectCls} value={fit} onChange={(e) => setFit(e.target.value)}>
          <option value="All">Fit: all</option>
          {["Strong fit", "Good fit", "Stretch", "Poor fit"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-[12.5px] text-muted ml-auto">{rows.length} of {apiRows.length}</span>
      </div>

      <Panel>
        {/* desktop: dense table */}
        <div className="hidden md:block overflow-x-auto"><table className="w-full border-collapse">
          <thead>
            <tr>
              {["Applicant", "Role", "Stage", "JewelCert", "JewelCert profile", "Fit", "Notes", "Last activity", ""].map((h) => (
                <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <Row key={a.id} a={a} />
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-muted text-[13px]">{!loaded ? "Loading applicants…" : loadError ? "We couldn't load your pipeline. Please refresh to try again." : apiRows.length === 0 ? "No applicants yet — applications from your careers page show up here." : "No applicants match these filters."}</td></tr>
            )}
          </tbody>
        </table></div>

        {/* mobile: stacked applicant cards */}
        <div className="md:hidden divide-y divide-[#eef1f6]">
          {rows.map((a) => (
            <MobileRow key={a.id} a={a} />
          ))}
          {rows.length === 0 && (
            <div className="px-4 py-10 text-center text-muted text-[13px]">{!loaded ? "Loading applicants…" : loadError ? "We couldn't load your pipeline. Please refresh to try again." : apiRows.length === 0 ? "No applicants yet — applications from your careers page show up here." : "No applicants match these filters."}</div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function StageChip({ label, n, active, onClick }: { label: string; n: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-md border ${
        active ? "bg-[#e8f1ff] border-primary text-primary font-medium" : "bg-panel border-line text-body hover:bg-rowhover"
      }`}
    >
      {label}
      <span className={`text-[11px] rounded-full px-1.5 ${active ? "bg-[#d7e6ff]" : "bg-[#eef2f7] text-muted"}`}>{n}</span>
    </button>
  );
}

function Row({ a }: { a: PipelineApplicant }) {
  return (
    <tr className="hover:bg-rowhover">
      <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
        <Link href={`/applicants/${a.id}`} className="flex items-center gap-2.5 no-underline">
          <span className="w-[30px] h-[30px] rounded-full bg-[#e8f1ff] flex items-center justify-center text-[11px] font-bold text-primary">{a.initials}</span>
          <span>
            <span className="block font-medium text-head">{a.name}</span>
            <span className="block text-[11.5px] text-muted">{a.location}</span>
          </span>
        </Link>
      </td>
      <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">{a.role}</td>
      <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><span className={`inline-flex text-[11.5px] font-medium px-2.5 py-1 rounded-full ${STAGE_STYLE[a.stage]}`}>{stageLabel(a.stage)}</span></td>
      <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><JewelCert status={a.jewelcert.status} score={a.jewelcert.score} /></td>
      <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
        {a.gemmatch ? <TypeLabel primary={a.gemmatch.primary} type={a.gemmatch.type} /> : <span className="text-muted">—</span>}
      </td>
      <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
        {a.gemmatch ? <FitBadge score={a.gemmatch.fitScore} tier={a.gemmatch.tier} /> : <span className="text-muted">—</span>}
      </td>
      <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
        <span className="inline-flex items-center gap-1 text-muted"><IconFileText size={14} /> {a.notes}</span>
      </td>
      <td className="px-4 py-3 border-b border-[#eef1f6] text-[12.5px] text-muted">
        {a.interviewAt ? <span className="text-[#0f6e56]">Interview {a.interviewAt}</span> : a.lastActivity}
      </td>
      <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
        <div className="flex items-center gap-1.5 justify-end">
          <Link href="/interviews" title="Schedule interview" className="w-8 h-8 rounded-md border border-line text-muted hover:bg-rowhover hover:text-primary flex items-center justify-center"><IconCalendar size={16} /></Link>
          <Link href={`/hire/${a.id}`} title="Hire → JewelLink" className="w-8 h-8 rounded-md border border-line text-muted hover:bg-rowhover hover:text-primary flex items-center justify-center"><IconUserPlus size={16} /></Link>
          <Link href={`/applicants/${a.id}`} title="Open" className="w-8 h-8 rounded-md border border-line text-muted hover:bg-rowhover hover:text-primary flex items-center justify-center"><IconChevronRight size={16} /></Link>
        </div>
      </td>
    </tr>
  );
}

function ActionLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="w-8 h-8 rounded-md border border-line text-muted hover:bg-rowhover hover:text-primary flex items-center justify-center shrink-0"
    >
      {children}
    </Link>
  );
}

function MobileRow({ a }: { a: PipelineApplicant }) {
  return (
    <div className="p-4">
      <div className="flex items-start gap-2.5">
        <Link href={`/applicants/${a.id}`} className="flex items-center gap-2.5 no-underline min-w-0 flex-1">
          <span className="w-9 h-9 rounded-full bg-[#e8f1ff] flex items-center justify-center text-[12px] font-bold text-primary shrink-0">{a.initials}</span>
          <span className="min-w-0">
            <span className="block font-medium text-head text-[14px] truncate">{a.name}</span>
            <span className="block text-[12px] text-muted truncate">{a.location} · {a.role}</span>
          </span>
        </Link>
        <span className={`inline-flex text-[11.5px] font-medium px-2.5 py-1 rounded-full shrink-0 ${STAGE_STYLE[a.stage]}`}>{stageLabel(a.stage)}</span>
      </div>

      {/* screening signals */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">JewelCert</span>
        <JewelCert status={a.jewelcert.status} score={a.jewelcert.score} />
        {a.gemmatch && <FitBadge score={a.gemmatch.fitScore} tier={a.gemmatch.tier} />}
      </div>
      {a.gemmatch && (
        <div className="mt-2 text-[12.5px]"><TypeLabel primary={a.gemmatch.primary} type={a.gemmatch.type} /></div>
      )}

      {/* meta + primary actions */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1"><IconFileText size={14} /> {a.notes}</span>
          <span>{a.interviewAt ? <span className="text-[#0f6e56]">Interview {a.interviewAt}</span> : a.lastActivity}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ActionLink href="/interviews" label="Schedule interview"><IconCalendar size={16} /></ActionLink>
          <ActionLink href={`/hire/${a.id}`} label="Hire → JewelLink"><IconUserPlus size={16} /></ActionLink>
          <ActionLink href={`/applicants/${a.id}`} label="Open applicant"><IconChevronRight size={16} /></ActionLink>
        </div>
      </div>
    </div>
  );
}
