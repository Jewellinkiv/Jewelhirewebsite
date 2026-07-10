"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getApplicant, getApplicantProfile, ApplicantNote, AppHistory, ApplicantRecord, ApplicantProfile } from "@/lib/applicants";
import { Panel, Radar, MixBars, FitBadge } from "@/components/ui";
import { PROFILES } from "@/lib/gemmatch";
import {
  IconLock, IconDiamond, IconUser, IconSend,
  IconCalendar, IconUserPlus, IconClipboardList,
} from "@/components/icons";

const OUTCOME: Record<AppHistory["outcome"], string> = {
  "In progress": "bg-[#e8f1ff] text-primary",
  Hired: "bg-[#dff3e8] text-[#0f6e56]",
  Rejected: "bg-[#fcebeb] text-[#a32d2d]",
  Withdrawn: "bg-[#eef2f7] text-[#5b6472]",
};
function barColor(p: number) { return p >= 75 ? "#1f9e75" : p >= 50 ? "#c08a16" : "#c0492f"; }

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function initials(name: string) {
  return name.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase() || "NA";
}

function statusFromApi(status: string): ApplicantRecord["status"] {
  if (status === "Hired" || status === "Rejected" || status === "Withdrawn") return status;
  return "Active";
}

function mapApiDetail(body: any): { rec: ApplicantRecord; prof: ApplicantProfile } {
  const name = body.profile?.fullName || "Applicant";
  const role = body.job?.title || body.profile?.resumeHeadline || "Jewelry role";
  return {
    rec: {
      id: body.id,
      linkable: true,
      name,
      initials: initials(name),
      role,
      status: statusFromApi(body.status),
      stage: body.application?.stage || "applied",
      appliedDate: formatDate(body.application?.submittedAt || body.application?.createdAt || ""),
      lastActivity: formatDate(body.application?.lastActivityAt || body.application?.updatedAt || ""),
      email: body.profile?.email || "",
      notes: (body.notes || []).map((note: any) => ({
        author: note.authorUserId === "user-hiring-manager" ? "William Jones" : note.authorUserId,
        when: formatDate(note.createdAt),
        text: note.body,
      })),
    },
    prof: {
      about: body.resume?.summary || body.profile?.summary || "",
      applications: (body.applications || []).map((item: any) => ({
        id: item.id,
        role: item.role,
        appliedDate: formatDate(item.appliedDate),
        outcome: item.outcome,
        note: item.note,
      })),
      gemmatch: body.gemmatch,
      tests: body.tests || [],
    },
  };
}

export default function ApplicantProfilePage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const seeded = getApplicant(params.id);
  const seededProfile = getApplicantProfile(params.id);
  const [rec, setRec] = useState<ApplicantRecord>(
    seeded || {
      id: params.id,
      linkable: true,
      name: "Applicant",
      initials: "AP",
      role: "Jewelry role",
      status: "Active",
      stage: "applied",
      appliedDate: "",
      lastActivity: "",
      email: "",
      notes: [],
    },
  );
  const [prof, setProf] = useState<ApplicantProfile>(seededProfile);
  const [missing, setMissing] = useState(false);
  // Real application id (from the detail API) so actions like Send JewelCert
  // carry the recipient instead of dropping the owner on an unscoped composer.
  const [applicationId, setApplicationId] = useState("");
  const [notes, setNotes] = useState<ApplicantNote[]>(seeded?.notes || []);
  const [draft, setDraft] = useState("");
  const addNote = async () => {
    if (!draft.trim()) return;
    const text = draft.trim();
    setNotes((n) => [{ author: "William Jones", when: "Just now", text }, ...n]);
    setDraft("");
    await fetch(`/api/applicants/${params.id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch(() => undefined);
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/applicants/${params.id}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Applicant not found"))))
      .then((body) => {
        if (cancelled) return;
        const mapped = mapApiDetail(body);
        if (typeof body.applicationId === "string") setApplicationId(body.applicationId);
        setRec(mapped.rec);
        setProf(mapped.prof);
        setNotes(mapped.rec.notes);
      })
      .catch(() => {
        if (!cancelled && !seeded) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, seeded]);

  if (missing) {
    return (
      <Panel>
        <div className="p-6">
          <h1 className="m-0 text-lg font-semibold text-head">Applicant not found</h1>
          <Link href="/applicants" className="mt-3 inline-block text-primary no-underline">Back to applicants</Link>
        </div>
      </Panel>
    );
  }

  const gm = prof.gemmatch;
  const applyCount = prof.applications.length;

  return (
    <div>
      <div className="text-[12.5px] text-muted mb-3.5">
        <Link href="/applicants" className="text-primary no-underline">Applicants</Link> / {rec.name}
      </div>

      {/* header */}
      <div className="flex flex-wrap items-center gap-3.5 bg-panel border border-line rounded px-[18px] py-4 mb-4">
        <div className="w-[52px] h-[52px] rounded-full bg-[#efe9fd] text-[#5a44c9] flex items-center justify-center font-semibold text-[19px]">{rec.initials}</div>
        <div>
          <h1 className="text-[20px] font-bold text-head m-0">{rec.name}</h1>
          <div className="text-[13px] text-muted mt-[3px] flex gap-2 items-center flex-wrap">
            {rec.role} · {rec.email}
            {applyCount > 0 && <span className="inline-flex text-[11.5px] font-medium px-2 py-0.5 rounded-full bg-[#eef2f7] text-[#5b6472]">Applied {applyCount}×</span>}
            {gm && <FitBadge score={gm.fitScore} tier={gm.tier} />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_330px] gap-4 items-start">
        {/* main */}
        <div>
          <Panel title="About" icon={<IconUser size={16} />} className="mb-4">
            <div className="p-4">
              <div className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[13px] mb-2">
                <span className="text-muted">Email</span><span>{rec.email}</span>
                <span className="text-muted">Role</span><span>{rec.role}</span>
                <span className="text-muted">Status</span><span>{rec.status}</span>
              </div>
              {prof.about && <p className="text-[13.5px] text-body leading-relaxed m-0">{prof.about}</p>}
            </div>
          </Panel>

          {/* combined JewelCert results */}
          <Panel title="JewelCert results" icon={<IconDiamond size={16} />} action={<span className="text-[11px] text-muted inline-flex items-center gap-1"><IconLock size={11} /> internal</span>} className="mb-4">
            {gm ? (
              <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3 items-center p-4 border-b border-[#eef1f6]">
                <div className="max-w-[200px] mx-auto"><Radar mix={gm.mix} size={200} /></div>
                <div>
                  <div className="text-[15px] font-bold text-head">{gm.type}</div>
                  <div className="text-[12.5px] text-muted mb-2">JewelCert · {PROFILES[gm.primary].name}-led · <b style={{ color: barColor(gm.fitScore) }}>{gm.fitScore} {gm.tier}</b></div>
                  <MixBars mix={gm.mix} />
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 text-[13px] text-muted border-b border-[#eef1f6]">JewelCert not completed.</div>
            )}
            <div className="p-4">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-muted mb-2 inline-flex items-center gap-1.5"><IconClipboardList size={13} /> Test scores</div>
              {prof.tests.length === 0 ? <div className="text-[13px] text-muted">No tests in this JewelCert.</div> : (
                <div className="space-y-2.5">
                  {prof.tests.map((t) => (
                    <div key={t.name} className="flex items-center gap-3">
                      <span className="w-[150px] text-[13px] text-head">{t.name}</span>
                      <span className="flex-1 h-2.5 bg-[#eef1f7] rounded-full overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${t.score}%`, background: barColor(t.score) }} /></span>
                      <span className="w-10 text-right text-[12.5px] font-semibold" style={{ color: barColor(t.score) }}>{t.score}</span>
                      <span className="w-[120px] text-[11.5px] text-muted">{t.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          {/* application history */}
          <Panel title={`Application history (${applyCount})`} icon={<IconCalendar size={16} />}>
            <div className="divide-y divide-[#eef1f6]">
              {prof.applications.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-head">{a.role}</div>
                    <div className="text-[12px] text-muted">Applied {a.appliedDate}{a.note ? ` · ${a.note}` : ""}</div>
                  </div>
                  <span className={`ml-auto text-[11.5px] font-medium px-2.5 py-1 rounded-full ${OUTCOME[a.outcome]}`}>{a.outcome}</span>
                </div>
              ))}
              {applyCount === 0 && <div className="px-4 py-3 text-[13px] text-muted">No applications yet.</div>}
            </div>
          </Panel>
        </div>

        {/* rail: notes + actions */}
        <div>
          <Panel title="Notes" icon={<IconUser size={16} />} action={<span className="text-[11px] text-muted inline-flex items-center gap-1"><IconLock size={11} /> internal</span>} className="mb-4">
            <div className="p-4">
              <div className="flex gap-2 mb-3">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} placeholder="Add a private note…" className="flex-1 border border-line rounded-md px-3 py-2 text-[13px] text-body outline-none focus:border-primary bg-white" />
                <button onClick={addNote} className="btn-grad px-4 py-2 text-[13px]">Add</button>
              </div>
              <div className="space-y-2">
                {notes.length === 0 && <div className="text-[12.5px] text-muted">No notes yet.</div>}
                {notes.map((n, i) => (
                  <div key={i} className="border border-line rounded-md px-3 py-2.5 bg-white">
                    <div className="text-[13px] text-body leading-relaxed">{n.text}</div>
                    <div className="text-[11.5px] text-muted mt-1">{n.author} · {n.when}</div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Actions">
            <div className="p-4 flex flex-col gap-2">
              <Link href={applicationId ? `/send-jewelcert?applicationId=${encodeURIComponent(applicationId)}` : "/send-jewelcert"} className="flex items-center gap-2.5 px-3 py-2.5 border border-line rounded-md no-underline text-body text-[13px] hover:bg-rowhover hover:border-accent"><span className="text-primary"><IconSend size={17} /></span> Send JewelCert</Link>
              <Link href="/interviews" className="flex items-center gap-2.5 px-3 py-2.5 border border-line rounded-md no-underline text-body text-[13px] hover:bg-rowhover hover:border-accent"><span className="text-primary"><IconCalendar size={17} /></span> Schedule interview</Link>
              <Link href={`/hire/${rec.id}`} className="flex items-center gap-2.5 px-3 py-2.5 border border-line rounded-md no-underline text-body text-[13px] hover:bg-rowhover hover:border-accent"><span className="text-primary"><IconUserPlus size={17} /></span> Hire → add to team</Link>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
