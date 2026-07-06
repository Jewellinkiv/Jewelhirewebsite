"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui";
import { PageLoading, ErrorState } from "@/components/states";
import { useCurrentSessionUser } from "@/lib/client-session";
import { STAGE_META, ApplicationStage } from "@/lib/my-applications";
import { IconBriefcase, IconCalendar, IconClipboardList, IconChevronRight, IconCheck } from "@/components/icons";

const TONE: Record<string, string> = {
  active: "bg-[#e8f1ff] text-primary",
  good: "bg-[#e1f5ee] text-[#0f6e56]",
  pending: "bg-[#fff4e2] text-[#9a6a12]",
  closed: "bg-[#eef2f7] text-[#5b6472]",
};

const ACTIVE: ApplicationStage[] = ["applied", "jewelcert", "gemmatch", "interview", "offer"];
const TODO: ApplicationStage[] = ["jewelcert", "gemmatch"];

interface Row {
  id: string;
  store: string;
  storeLocation: string;
  role: string;
  stage: ApplicationStage;
  submittedAt: string;
  nextStep?: string;
  nextStepHref?: string;
}

interface ApiApplicationItem {
  application: { id: string; stage: ApplicationStage; submittedAt: string; createdAt: string };
  store?: { id: string; name: string };
  job?: { title: string; location: string };
}

function nextStep(stage: ApplicationStage) {
  if (stage === "applied") return "Application received — the store is reviewing it";
  if (stage === "jewelcert") return "Finish your JewelCert knowledge check";
  if (stage === "gemmatch") return "Complete your JewelCert assessment (~3 min)";
  if (stage === "interview") return "Interview scheduled — confirm your time";
  if (stage === "offer") return "Offer extended — review the details";
  return undefined;
}

function nextStepHref(stage: ApplicationStage) {
  if (stage === "jewelcert" || stage === "gemmatch") return "/portal/invites";
  if (stage === "interview") return "/portal/interviews";
  return undefined;
}

function apiRows(items: ApiApplicationItem[]): Row[] {
  return items.map((item) => ({
    id: item.application.id,
    store: item.store?.name || "the store",
    storeLocation: item.job?.location || "",
    role: item.job?.title || "Jewelry role",
    stage: item.application.stage,
    submittedAt: new Date(item.application.submittedAt || item.application.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    nextStep: nextStep(item.application.stage),
    nextStepHref: nextStepHref(item.application.stage),
  }));
}

export default function AssociateHome() {
  const [apps, setApps] = useState<Row[]>([]);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const user = useCurrentSessionUser();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/applicant/applications")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Unable to load applications"))))
      .then((body) => {
        if (!cancelled) {
          setApps(apiRows(body.items || []));
          setStatus("loaded");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") return <PageLoading title="Loading your portal…" />;
  if (status === "error") {
    return (
      <div>
        <h1 className="text-[22px] font-semibold text-head m-0">Welcome back, {user.name.split(" ")[0]}</h1>
        <p className="mt-1 mb-5 text-muted text-[13.5px]">Here's where things stand across the stores you applied to.</p>
        <Panel><ErrorState message="We couldn't load this — please refresh." /></Panel>
      </div>
    );
  }

  const active = apps.filter((a) => ACTIVE.includes(a.stage));
  const todos = apps.filter((a) => TODO.includes(a.stage));
  const interviews = apps.filter((a) => a.stage === "interview");
  const offers = apps.filter((a) => a.stage === "offer");

  const stats = [
    { k: "Applications", v: apps.length, href: "/portal/applications", icon: <IconBriefcase size={16} /> },
    { k: "In progress", v: active.length, href: "/portal/applications", icon: <IconClipboardList size={16} /> },
    { k: "Interviews", v: interviews.length, href: "/portal/interviews", icon: <IconCalendar size={16} /> },
    { k: "Offers", v: offers.length, href: "/portal/applications", icon: <IconCheck size={16} /> },
  ];

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-head m-0">Welcome back, {user.name.split(" ")[0]}</h1>
      <p className="mt-1 mb-5 text-muted text-[13.5px]">Here's where things stand across the stores you applied to.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-[18px]">
        {stats.map((s) => (
          <Link key={s.k} href={s.href} className="no-underline group">
            <div className="bg-panel border border-line rounded-lg px-4 py-3.5 h-full group-hover:border-accent transition-colors">
              <div className="flex items-center gap-1.5 text-[12px] text-muted font-medium"><span className="text-primary">{s.icon}</span>{s.k}</div>
              <div className="text-2xl font-semibold text-head mt-1 leading-none">{s.v}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-[18px]">
        {/* next steps */}
        <Panel title="Your next steps" action={<Link href="/portal/applications" className="text-[12.5px] text-primary no-underline">All applications</Link>}>
          <div className="divide-y divide-[#eef1f6]">
            {active.filter((a) => a.nextStep).map((a) => {
              const isTodo = TODO.includes(a.stage);
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-9 h-9 rounded-full bg-[#eef2f7] flex items-center justify-center text-[12px] font-semibold text-[#5b6472]">{a.store.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium text-head">{a.store}</div>
                    <div className="text-[12px] text-muted">{a.nextStep}</div>
                  </div>
                  <div className="ml-auto">
                    {isTodo ? (
                      <Link href={a.nextStepHref ?? "/portal/invites"} className="btn-grad inline-flex items-center gap-1 px-3 py-1.5 text-[12.5px] no-underline">Start <IconChevronRight size={14} /></Link>
                    ) : (
                      <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${TONE[STAGE_META[a.stage].tone]}`}>{STAGE_META[a.stage].label}</span>
                    )}
                  </div>
                </div>
              );
            })}
            {active.length === 0 && <div className="px-4 py-8 text-center text-muted text-[13px]">Nothing needs your attention right now.</div>}
          </div>
        </Panel>

        {/* right column */}
        <div className="flex flex-col gap-[18px]">
          {interviews.length > 0 && (
            <Panel title={interviews.length > 1 ? "Upcoming interviews" : "Upcoming interview"} icon={<IconCalendar size={16} />}>
              <div className="p-4">
                {interviews.map((a) => (
                  <div key={a.id}>
                    <div className="text-[14px] font-semibold text-head">{a.store}</div>
                    <div className="text-[12.5px] text-muted">{a.role} · {a.storeLocation}</div>
                    <Link href="/portal/interviews" className="btn-outline inline-flex items-center gap-1 px-3.5 py-2 text-[12.5px] no-underline mt-3">Confirm your time <IconChevronRight size={14} /></Link>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <Panel title="To-do" icon={<IconClipboardList size={16} />}>
            <div className="p-4 text-[13px] text-body">
              {todos.length > 0 ? (
                <ul className="m-0 pl-4 space-y-1.5">
                  {todos.map((a) => <li key={a.id}>{a.nextStep} <span className="text-muted">— {a.store}</span></li>)}
                </ul>
              ) : (
                <span className="text-muted">You're all caught up.</span>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
