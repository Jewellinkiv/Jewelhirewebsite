"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common";
import { Panel } from "@/components/ui";
import { CANDIDATES } from "@/lib/data";
import { LEGACY_ASSESSMENTS, LEGACY_COURSE_TOTALS } from "@/lib/legacy";
import { IconClipboardList, IconSchool, IconSend, IconUserPlus } from "@/components/icons";
import { useActiveStoreId } from "@/lib/client-session";

type InviteStatus = "Sent" | "Opened" | "Started" | "Completed" | "Expired";

const INVITES: {
  candidateId: string;
  candidate?: QueueCandidate | null;
  package: string;
  contents: string;
  status: InviteStatus;
  sent: string;
  due: string;
}[] = [
  {
    candidateId: "bryan-lett",
    package: "JewelCert + 12 Essentials",
    contents: "JewelCert profile, 12 Essentials",
    status: "Opened",
    sent: "Today",
    due: "Jun 26",
  },
  {
    candidateId: "kate-pryor",
    package: "Sales Associate screen",
    contents: "JewelCert profile, Sales Personality, Jewelry Basic Knowledge",
    status: "Sent",
    sent: "Today",
    due: "Jun 27",
  },
  {
    candidateId: "maya-chen",
    package: "Training follow-up",
    contents: "Diamond Fundamentals, Clienteling and Follow-up",
    status: "Started",
    sent: "Yesterday",
    due: "Jun 25",
  },
  {
    candidateId: "devon-ross",
    package: "Bench readiness",
    contents: "Jewelry Basic Knowledge, Diamond Product Knowledge Book",
    status: "Completed",
    sent: "Jun 20",
    due: "Jun 24",
  },
];

type QueueCandidate = {
  id: string;
  name: string;
  initials: string;
  role: string;
  email?: string;
};

type QueueInvite = {
  candidateId: string;
  candidate?: QueueCandidate | null;
  package: string;
  contents: string;
  status: InviteStatus;
  sent: string;
  due: string;
};
const FALLBACK_STORE_ID = "store-sissys-little-rock";

const STATUS_STYLE: Record<InviteStatus, string> = {
  Sent: "bg-[#eef2f7] text-[#5b6472]",
  Opened: "bg-[#fff4e2] text-[#9a6a12]",
  Started: "bg-[#e8f1ff] text-primary",
  Completed: "bg-[#e1f5ee] text-[#0f6e56]",
  Expired: "bg-[#fcebeb] text-[#a32d2d]",
};

const PACKAGE_TEMPLATES = [
  {
    title: "JewelCert profile",
    icon: <IconSend size={17} />,
    audience: "Every candidate",
    detail: "Primary invite for candidate style, fit, and manager coaching notes.",
    items: ["JewelCert assessment", "Candidate share page", "Manager fit report"],
  },
  {
    title: "Sales Associate screen",
    icon: <IconClipboardList size={17} />,
    audience: "Retail sales roles",
    detail: "Combines personality and jewelry knowledge for pre-interview review.",
    items: ["Sales Personality", "Jewelry Basic Knowledge", "12 Essentials optional"],
  },
  {
    title: "Training starter pack",
    icon: <IconSchool size={17} />,
    audience: "New hires or finalists",
    detail: "Assigns foundational courses before or immediately after hiring.",
    items: ["Diamond Fundamentals", "Sales process", "Clienteling basics"],
  },
];

function InviteStatusChip({ status }: { status: InviteStatus }) {
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-[11.5px] font-medium ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="bg-panel border border-line rounded px-4 py-[15px]">
      <div className="text-xs text-muted font-medium">{label}</div>
      <div className="text-2xl font-semibold text-head mt-[5px] leading-none">{value}</div>
      <div className="text-xs mt-[5px] text-muted">{sub}</div>
    </div>
  );
}

export default function CertInvitationsPage() {
  const STORE_ID = useActiveStoreId(FALLBACK_STORE_ID);
  // Start empty (not seeded with demo invites) so we never flash another store's
  // data; real invites for THIS store load below.
  const [invites, setInvites] = useState<QueueInvite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const pending = invites.filter((invite) => invite.status !== "Completed" && invite.status !== "Expired").length;
  const completed = invites.filter((invite) => invite.status === "Completed").length;
  const candidateMap = new Map(CANDIDATES.map((candidate) => [candidate.id, candidate]));

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    fetch(`/api/stores/${STORE_ID}/invites`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: {
        items: {
          candidate: QueueCandidate | null;
          package: string;
          contents: string;
          status: InviteStatus;
          sent: string;
          due: string;
        }[];
      }) => {
        if (!cancelled) {
          setInvites(data.items.map((item) => ({
            candidateId: item.candidate?.id || "unknown",
            candidate: item.candidate,
            package: item.package,
            contents: item.contents,
            status: item.status,
            sent: item.sent,
            due: item.due,
          })));
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [STORE_ID]);

  return (
    <div>
      <PageHeader
        title="Cert invitations"
        subtitle="Send JewelCert, aptitude tests, and training packages without copying the legacy Bubble flow."
        action={
          <Link href="/send-jewelcert" className="btn-grad inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[12.5px] no-underline">
            <IconUserPlus size={15} /> New invitation
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-[18px]">
        <Stat label="Open invites" value={pending} sub="Sent, opened, or started" />
        <Stat label="Completed" value={completed} sub="Ready for manager review" />
        <Stat label="Assessment options" value={LEGACY_ASSESSMENTS.length + 1} sub="JewelCert plus legacy tests" />
        <Stat label="Training courses" value={LEGACY_COURSE_TOTALS.total} sub={`${LEGACY_COURSE_TOTALS.published} published`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-[18px] items-start">
        <Panel title="Invitation queue" action={<Link href="/applicants" className="text-[12.5px] text-primary no-underline">Review candidates</Link>}>
          <div className="overflow-x-auto"><table className="w-full border-collapse">
            <thead>
              <tr>
                {["Candidate", "Package", "Contents", "Status", "Sent", "Due"].map((h) => (
                  <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => {
                const candidate = invite.candidate || candidateMap.get(invite.candidateId);
                return (
                  <tr key={`${invite.candidateId}-${invite.package}`} className="hover:bg-rowhover align-top">
                    <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                      {candidate ? (
                        <Link href={`/applicants/${(candidate as { profileId?: string }).profileId || candidate.id}`} className="flex items-center gap-2.5 no-underline">
                          <span className="w-[30px] h-[30px] rounded-full bg-[#eef2f7] flex items-center justify-center text-[11px] font-semibold text-[#5b6472]">{candidate.initials}</span>
                          <span>
                            <span className="block font-medium text-head">{candidate.name}</span>
                            <span className="block text-[12px] text-muted">{candidate.role}</span>
                          </span>
                        </Link>
                      ) : (
                        <span className="text-muted">Unknown candidate</span>
                      )}
                    </td>
                    <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] font-medium text-head">{invite.package}</td>
                    <td className="px-4 py-3 border-b border-[#eef1f6] text-[12.5px] text-body max-w-[280px]">{invite.contents}</td>
                    <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><InviteStatusChip status={invite.status} /></td>
                    <td className="px-4 py-3 border-b border-[#eef1f6] text-[12.5px] text-muted">{invite.sent}</td>
                    <td className="px-4 py-3 border-b border-[#eef1f6] text-[12.5px] text-muted">{invite.due}</td>
                  </tr>
                );
              })}
              {!loaded && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted text-[13px]">Loading invitations…</td></tr>}
              {loaded && invites.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted text-[13px]">No invitations yet.</td></tr>}
            </tbody>
          </table></div>
        </Panel>

        <div className="space-y-[18px]">
          <Panel title="Package templates">
            <div className="divide-y divide-[#eef1f6]">
              {PACKAGE_TEMPLATES.map((template) => (
                <div key={template.title} className="p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-md bg-[#e8f1ff] text-primary flex items-center justify-center">{template.icon}</span>
                    <div>
                      <div className="text-[13px] font-semibold text-head">{template.title}</div>
                      <div className="text-[12px] text-muted">{template.audience}</div>
                    </div>
                  </div>
                  <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-body">{template.detail}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {template.items.map((item) => (
                      <span key={item} className="rounded-md bg-page border border-line px-2 py-1 text-[11.5px] text-muted">{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="V2 invite rules">
            <div className="p-4 text-[12.5px] text-body leading-relaxed space-y-2">
              <p className="m-0">Keep invite packages role-based, not page-based. A store manager should pick a package, candidate, due date, and message.</p>
              <p className="m-0">Legacy aptitude tests stay available as seed assessments, but JewelCert should be the primary invite in v2.</p>
              <p className="m-0">Training can be assigned to finalists or new hires without mixing it into the assessment score.</p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
