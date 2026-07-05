"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui";
import { ASSOC_INVITES, AssociateInvite } from "@/lib/associate-portal";
import { IconClipboardList, IconCheck, IconDiamond, IconChevronRight } from "@/components/icons";

const STATUS_STYLE: Record<string, string> = {
  "To do": "bg-[#fff4e2] text-[#9a6a12]",
  "In progress": "bg-[#e8f1ff] text-primary",
  Completed: "bg-[#e1f5ee] text-[#0f6e56]",
};

interface ApiInvite {
  id: string;
  kind: AssociateInvite["kind"];
  status: "sent" | "started" | "completed" | "expired" | "cancelled";
  assessmentPackageId?: string;
  sentAt?: string;
  createdAt?: string;
  job?: { title: string };
}

type PortalInvite = AssociateInvite & {
  assessmentPackageId?: string;
};

function inviteDisplayKind(kind: AssociateInvite["kind"]) {
  return kind === "GemMatch" ? "JewelCert" : kind;
}

function statusLabel(status: ApiInvite["status"]): AssociateInvite["status"] {
  if (status === "completed") return "Completed";
  if (status === "started") return "In progress";
  return "To do";
}

function formatDate(value?: string) {
  if (!value) return "today";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function toInvite(item: ApiInvite): PortalInvite {
  return {
    id: item.id,
    store: "Sissy's Log Cabin",
    role: item.job?.title || "Jewelry role",
    kind: item.kind,
    sentAt: formatDate(item.sentAt || item.createdAt),
    status: statusLabel(item.status),
    estMinutes: item.kind === "GemMatch" ? 3 : 10,
    assessmentPackageId: item.assessmentPackageId,
  };
}

export default function InvitesPage() {
  const [seed, setSeed] = useState<PortalInvite[]>(ASSOC_INVITES);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/applicant/invites")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Unable to load invites"))))
      .then((body) => {
        // Only surface actionable invites. statusLabel() collapses every status
        // except "started"/"completed" to "To do", so an expired, cancelled, or
        // still-draft invite would otherwise render in the "To complete" list
        // with a working Start button — letting an applicant open an assessment
        // that expired or was never sent. Keep sent/started/completed only.
        if (!cancelled)
          setSeed(
            ((body.items || []) as ApiInvite[])
              .filter(
                (item) =>
                  item.status === "sent" || item.status === "started" || item.status === "completed",
              )
              .map(toInvite),
          );
      })
      .catch(() => {
        if (!cancelled) setSeed(ASSOC_INVITES);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const list: PortalInvite[] = seed;
  const todo = list.filter((i) => i.status !== "Completed");
  const done = list.filter((i) => i.status === "Completed");

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-head m-0">Invites</h1>
      <p className="mt-1 mb-5 text-muted text-[13.5px]">Assessments stores asked you to complete. Your results are shared only with that store.</p>

      <Panel title={`To complete (${todo.length})`} icon={<IconClipboardList size={16} />} className="mb-[18px]">
        {todo.length > 0 ? (
          <div className="divide-y divide-[#eef1f6]">
            {todo.map((i) => (
              <div key={i.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="w-9 h-9 rounded-md bg-[#e8f1ff] text-primary flex items-center justify-center"><IconDiamond size={16} /></span>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-head">{inviteDisplayKind(i.kind)} · {i.store}</div>
                  <div className="text-[12px] text-muted">{i.role} · ~{i.estMinutes} min · sent {i.sentAt}</div>
                </div>
                <span className={`ml-auto text-[11px] font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[i.status]}`}>{i.status}</span>
                <Link href={i.kind === "GemMatch" ? `/jewelcert/${i.id}` : `/assessment/${i.id}`} className="btn-grad inline-flex items-center gap-1 px-3 py-1.5 text-[12.5px] no-underline">
                  {i.status === "In progress" ? "Continue" : "Start"} <IconChevronRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-muted text-[13px]">All caught up — nothing to complete.</div>
        )}
      </Panel>

      <Panel title={`Completed (${done.length})`}>
        {done.length > 0 ? (
          <div className="divide-y divide-[#eef1f6]">
            {done.map((i) => (
              <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-8 h-8 rounded-full bg-[#e1f5ee] text-[#0f6e56] flex items-center justify-center"><IconCheck size={15} /></span>
                <div className="text-[13px] text-head font-medium">{inviteDisplayKind(i.kind)} · {i.store}</div>
                <span className="ml-auto text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#e1f5ee] text-[#0f6e56]">Completed</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-muted text-[13px]">Nothing completed yet.</div>
        )}
      </Panel>
    </div>
  );
}
