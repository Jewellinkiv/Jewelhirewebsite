"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui";
import { EmptyState } from "@/components/states";
import { IconBriefcase } from "@/components/icons";
import { SEED_APPLICATIONS, STAGE_META, STAGE_FLOW, ApplicationStage } from "@/lib/my-applications";

const TONE: Record<string, string> = {
  active: "bg-[#e8f1ff] text-primary",
  good: "bg-[#e1f5ee] text-[#0f6e56]",
  pending: "bg-[#fff4e2] text-[#9a6a12]",
  closed: "bg-[#eef2f7] text-[#5b6472]",
};
const CLOSED: ApplicationStage[] = ["rejected", "withdrawn"];

interface Row {
  id: string;
  store: string;
  storeLocation?: string;
  role: string;
  stage: ApplicationStage;
  submittedAt: string;
  nextStep?: string;
  isNew?: boolean;
}

interface ApiApplicationItem {
  application: {
    id: string;
    stage: ApplicationStage;
    submittedAt: string;
    createdAt: string;
  };
  job?: {
    title: string;
    location: string;
  };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function nextStep(stage: ApplicationStage) {
  if (stage === "applied") return "Application received — the store is reviewing it";
  if (stage === "jewelcert") return "Finish your JewelCert knowledge check";
  if (stage === "gemmatch") return "Complete your GemMatch assessment (~3 min)";
  if (stage === "interview") return "Interview scheduled — confirm your time";
  if (stage === "offer") return "Offer extended — review the details";
  return undefined;
}

function toSeedRows(): Row[] {
  return SEED_APPLICATIONS.map((a) => ({
    id: a.id,
    store: a.store,
    storeLocation: a.storeLocation,
    role: a.role,
    stage: a.stage,
    submittedAt: a.submittedAt,
    nextStep: a.nextStep,
  }));
}

function toApiRows(items: ApiApplicationItem[]): Row[] {
  return items.map((item) => ({
    id: item.application.id,
    store: "Sissy's Log Cabin",
    storeLocation: item.job?.location,
    role: item.job?.title || "Jewelry role",
    stage: item.application.stage,
    submittedAt: formatDate(item.application.submittedAt || item.application.createdAt),
    nextStep: nextStep(item.application.stage),
    isNew: item.application.id.startsWith("app-") && !item.application.id.includes("maya-chen"),
  }));
}

function Track({ stage }: { stage: ApplicationStage }) {
  const idx = STAGE_FLOW.indexOf(stage);
  return (
    <div className="flex items-center gap-1 mt-2.5">
      {STAGE_FLOW.map((s, i) => <span key={s} className={`h-1.5 flex-1 rounded-full ${idx >= 0 && i <= idx ? "bg-primary" : "bg-[#e6eaf1]"}`} />)}
    </div>
  );
}

function Card({ a }: { a: Row }) {
  const meta = STAGE_META[a.stage];
  return (
    <div className="px-4 py-3.5 border-b border-[#eef1f6] last:border-0">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-[#eef2f7] flex items-center justify-center text-[12px] font-semibold text-[#5b6472]">{a.store.slice(0, 2).toUpperCase()}</span>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-head flex items-center gap-2">{a.store}{a.isNew && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#e1f5ee] text-[#0f6e56]">New</span>}</div>
          <div className="text-[12px] text-muted">{a.role}{a.storeLocation ? ` · ${a.storeLocation}` : ""}</div>
        </div>
        <span className={`ml-auto text-[11px] font-medium px-2.5 py-1 rounded-full ${TONE[meta.tone]}`}>{meta.label}</span>
      </div>
      {!CLOSED.includes(a.stage) && <Track stage={a.stage} />}
      <div className="flex items-center justify-between mt-2 text-[12px]">
        <span className="text-muted">Applied {a.submittedAt}</span>
        {a.nextStep && <span className="text-body">{a.nextStep}</span>}
      </div>
    </div>
  );
}

export default function ApplicationsPage() {
  const [all, setAll] = useState<Row[]>(toSeedRows);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/applicant/applications")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Unable to load applications"))))
      .then((body) => {
        if (!cancelled) setAll(toApiRows(body.items || []));
      })
      .catch(() => {
        if (!cancelled) setAll(toSeedRows());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = all.filter((a) => !CLOSED.includes(a.stage));
  const past = all.filter((a) => CLOSED.includes(a.stage));

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-head m-0">My applications</h1>
      <p className="mt-1 mb-5 text-muted text-[13.5px]">Only the stores you applied to — private to you.</p>

      <Panel title={`Active (${open.length})`} className="mb-[18px]">
        {open.length > 0 ? (
          <div>{open.map((a) => <Card key={a.id} a={a} />)}</div>
        ) : (
          <EmptyState
            icon={<IconBriefcase size={20} />}
            title="No active applications"
            message="When you apply to a store's hiring page, it shows up here so you can track its status."
            action={<Link href="/portal" className="btn-outline px-4 py-2 text-[13px] no-underline">Back to home</Link>}
          />
        )}
      </Panel>

      <Panel title={`History (${past.length})`}>
        {past.length > 0 ? <div>{past.map((a) => <Card key={a.id} a={a} />)}</div> : <div className="px-4 py-8 text-center text-muted text-[13px]">No past applications.</div>}
      </Panel>
    </div>
  );
}
