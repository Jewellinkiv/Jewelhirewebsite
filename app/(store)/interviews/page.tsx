"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common";
import { Panel } from "@/components/ui";
import { INTERVIEWS, Interview, InterviewType, InterviewStatus } from "@/lib/interviews";
import { APPLICANTS } from "@/lib/applicants";
import { INVITE_SETTINGS, PROVIDER_LABEL } from "@/lib/invite-settings";
import { IconCalendar, IconCheck, IconX, IconPlus, IconSend, IconUserPlus, IconSettings, IconVideo, IconMail } from "@/components/icons";

const TYPE_STYLE: Record<InterviewType, string> = {
  "In-person": "bg-[#e8f1ff] text-primary",
  Video: "bg-[#efe9fd] text-[#5a44c9]",
  Phone: "bg-[#eef2f7] text-[#5b6472]",
};
const STATUS_STYLE: Record<InterviewStatus, string> = {
  Scheduled: "bg-[#e8f1ff] text-primary",
  Completed: "bg-[#dff3e8] text-[#0f6e56]",
  "No-show": "bg-[#fff4e2] text-[#9a6a12]",
};

const ROLES = ["Sales Associate", "Sales Manager", "Bench Jeweler", "Bridal Specialist", "Repair Coordinator"];
const ACTIVE_APPLICANTS = APPLICANTS.filter((a) => a.status === "Active");
const STORE_ID = "store-sissys-little-rock";
const PUBLIC_STORE_SLUG = "sissys-log-cabin-careers";
const DEFAULT_JOB_ID = "job-luxury-sales-associate";
const initialsOf = (n: string) => n.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

const meetProviderLabel = (p: "google" | "microsoft" | null) => (p === "microsoft" ? "Microsoft Teams" : "Google Meet");
function genMeet(p: "google" | "microsoft" | null): string {
  const s = () => Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 4) || "meet";
  return p === "microsoft" ? `teams.microsoft.com/meet/${s()}${s()}` : `meet.google.com/${s().slice(0, 3)}-${s()}-${s().slice(0, 3)}`;
}

function fmtWhen(date: string, time: string): string {
  if (!date) return "";
  const d = new Date(`${date}T${time || "09:00"}`);
  if (isNaN(d.getTime())) return date;
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const tm = time ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
  return tm ? `${day} · ${tm}` : day;
}

function fmtWhenIso(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const tm = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${tm}`;
}

function typeFromApi(type: string): InterviewType {
  if (type === "video") return "Video";
  if (type === "phone") return "Phone";
  return "In-person";
}

function statusFromApi(status: string): InterviewStatus {
  if (status === "completed") return "Completed";
  if (status === "no_show") return "No-show";
  return "Scheduled";
}

function statusToApi(status: InterviewStatus) {
  if (status === "Completed") return "completed";
  if (status === "No-show") return "no_show";
  return "scheduled";
}

export default function InterviewsPage() {
  const [inviteSettings, setInviteSettings] = useState(INVITE_SETTINGS);
  const [list, setList] = useState<Interview[]>(INTERVIEWS);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({
    applicantId: ACTIVE_APPLICANTS[0]?.id ?? "",
    date: "",
    time: "",
    duration: INVITE_SETTINGS.defaultDuration,
    type: "In-person" as InterviewType,
    location: INVITE_SETTINGS.location,
    interviewer: "William Jones",
    name: "",
    email: "",
    role: ROLES[0],
    sendInvite: true,
    addMeet: true,
    meetLink: "",
    guests: [] as string[],
    notes: "",
  });

  const connected = inviteSettings.calendarProvider;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stores/${STORE_ID}/invite-settings`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { inviteSettings: typeof INVITE_SETTINGS }) => {
        if (cancelled) return;
        setInviteSettings(data.inviteSettings);
        setDraft((current) => ({
          ...current,
          duration: data.inviteSettings.defaultDuration,
          location: data.inviteSettings.location,
        }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stores/${STORE_ID}/interviews`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: {
        items: {
          interview: { id: string; startsAt: string; locationType: string; status: string; outcome?: string; locationDetails?: string; interviewerUserIds?: string[] };
          applicant: { id: string; name: string; initials: string; role: string } | null;
        }[];
      }) => {
        if (cancelled) return;
        setList(data.items.map((item) => ({
          id: item.interview.id,
          applicantId: item.applicant?.id || item.interview.id,
          linkable: Boolean(item.applicant),
          name: item.applicant?.name || "Unknown applicant",
          initials: item.applicant?.initials || "NA",
          role: item.applicant?.role || "Jewelry role",
          when: fmtWhenIso(item.interview.startsAt),
          type: typeFromApi(item.interview.locationType),
          status: statusFromApi(item.interview.status),
          interviewer: item.interview.interviewerUserIds?.join(", ") || "William Jones",
          notes: item.interview.outcome || "",
          meetLink: item.interview.locationType === "video" ? item.interview.locationDetails : undefined,
        })));
      })
      .catch(() => {
        if (!cancelled) setList(INTERVIEWS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openModal = () => {
    setDraft((d) => ({ ...d, meetLink: genMeet(connected) }));
    setOpen(true);
  };
  const upcoming = list.filter((i) => i.status === "Scheduled");
  const past = list.filter((i) => i.status !== "Scheduled");

  const setStatus = async (id: string, status: InterviewStatus) => {
    const current = list.find((interview) => interview.id === id);
    setList((l) => l.map((i) => (i.id === id ? { ...i, status } : i)));
    const response = await fetch(`/api/interviews/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: statusToApi(status), notes: current?.notes }),
    }).catch(() => undefined);
    if (response && !response.ok) {
      setNotice("Interview outcome updated locally; backend record was not found for this row.");
    }
  };

  const when = fmtWhen(draft.date, draft.time);
  const canSubmit = !!draft.date && (mode === "existing" ? !!draft.applicantId : !!draft.name.trim() && !!draft.email.trim());

  const add = async () => {
    if (!canSubmit) return;
    const meetLink = draft.type === "Video" && draft.addMeet ? draft.meetLink : undefined;
    const guests = draft.guests.length ? draft.guests : undefined;
    const role = mode === "existing" ? ACTIVE_APPLICANTS.find((x) => x.id === draft.applicantId)?.role ?? draft.role : draft.role;
    let applicationId = "";
    if (mode === "existing") {
      const applicant = ACTIVE_APPLICANTS.find((x) => x.id === draft.applicantId);
      const response = await fetch(`/api/store/applications?q=${encodeURIComponent(applicant?.name || "")}`);
      const body = await response.json();
      applicationId = body.items?.[0]?.application?.id || "";
    } else {
      const response = await fetch(`/api/public/stores/${PUBLIC_STORE_SLUG}/applications`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobId: DEFAULT_JOB_ID,
          profile: {
            name: draft.name.trim(),
            email: draft.email.trim(),
            headline: draft.role,
            summary: "Created from store interview scheduling.",
          },
        }),
      });
      const body = await response.json();
      applicationId = body.applicationId || "";
    }
    if (!applicationId) {
      setNotice("Could not find or create an application for this interview.");
      return;
    }
    const createdResponse = await fetch(`/api/applications/${applicationId}/interviews`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date: draft.date,
        time: draft.time,
        duration: Number.parseInt(String(draft.duration), 10),
        type: draft.type === "Video" ? "video" : draft.type === "Phone" ? "phone" : "in_store",
        location: meetLink ?? draft.location,
        interviewer: draft.interviewer,
        notes: draft.notes,
      }),
    }).catch(() => undefined);
    const createdBody = createdResponse?.ok ? await createdResponse.json().catch(() => null) : null;
    const createdId = createdBody?.interview?.id || `iv${Date.now()}`;
    if (mode === "existing") {
      const a = ACTIVE_APPLICANTS.find((x) => x.id === draft.applicantId)!;
      setList((l) => [
        { id: createdId, applicantId: a.id, linkable: a.linkable, name: a.name, initials: a.initials, role: a.role, when, type: draft.type, status: "Scheduled", interviewer: draft.interviewer, notes: draft.notes, meetLink, guests },
        ...l,
      ]);
      setNotice(`Interview scheduled with ${a.name}${connected ? ` · ${PROVIDER_LABEL[connected]} invite queued from ${inviteSettings.account}` : ""}.`);
    } else {
      setList((l) => [
        { id: createdId, applicantId: `new-${Date.now()}`, linkable: false, name: draft.name.trim(), initials: initialsOf(draft.name), role: draft.role, when, type: draft.type, status: "Scheduled", interviewer: draft.interviewer, notes: draft.notes, meetLink, guests },
        ...l,
      ]);
      setNotice(
        draft.sendInvite
          ? `Interview scheduled. Email invite queued for ${draft.email.trim()} and will send when notifications are enabled.`
          : `Interview scheduled with ${draft.name.trim()}.`,
      );
    }
    setDraft({ ...draft, date: "", time: "", name: "", email: "", guests: [], notes: "" });
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Interviews"
        subtitle="Schedule interviews with applicants and record outcomes."
        action={
          <button onClick={openModal} className="btn-grad inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px]">
            <IconPlus size={16} /> Schedule interview
          </button>
        }
      />

      {/* connected status */}
      <div className={`mb-4 flex flex-wrap items-center gap-2 rounded-md border px-3.5 py-2.5 text-[12.5px] ${connected ? "border-[#cdeadd] bg-[#eef8f3]" : "border-[#f3d9cd] bg-[#fdf1ec]"}`}>
        <span className={`inline-flex items-center gap-1.5 font-medium ${connected ? "text-[#0f6e56]" : "text-[#993c1d]"}`}>
          <IconCalendar size={14} />
          {connected ? `${PROVIDER_LABEL[connected]} connected` : "No calendar connected"}
        </span>
        {connected && <span className="text-muted">· invites send from {inviteSettings.fromName} ({inviteSettings.account})</span>}
        <Link href="/settings" className="ml-auto inline-flex items-center gap-1 text-primary no-underline hover:underline">
          <IconSettings size={14} /> Manage in Settings
        </Link>
      </div>

      {notice && (
        <div className="mb-4 flex items-center gap-2 bg-[#e1f5ee] border border-[#cdeadd] text-[#0f6e56] rounded-md px-3.5 py-2.5 text-[13px]">
          <IconCheck size={15} /> {notice}
          <button onClick={() => setNotice("")} className="ml-auto text-[#0f6e56]/70 hover:text-[#0f6e56]"><IconX size={15} /></button>
        </div>
      )}

      <Panel title={`Upcoming (${upcoming.length})`} icon={<IconCalendar size={16} />} className="mb-4">
        <div className="divide-y divide-[#eef1f6]">
          {upcoming.map((i) => <Row key={i.id} i={i} onComplete={() => setStatus(i.id, "Completed")} onNoShow={() => setStatus(i.id, "No-show")} />)}
          {upcoming.length === 0 && <div className="px-4 py-8 text-center text-muted text-[13px]">No upcoming interviews.</div>}
        </div>
      </Panel>

      <Panel title={`Past (${past.length})`}>
        <div className="divide-y divide-[#eef1f6]">
          {past.map((i) => <Row key={i.id} i={i} />)}
          {past.length === 0 && <div className="px-4 py-8 text-center text-muted text-[13px]">No past interviews.</div>}
        </div>
      </Panel>

      {open && (
        <Modal onClose={() => setOpen(false)} draft={draft} setDraft={setDraft} mode={mode} setMode={setMode} when={when} canSubmit={canSubmit} onSubmit={add} connected={connected} inviteSettings={inviteSettings} />
      )}
    </div>
  );
}

function Modal({ onClose, draft, setDraft, mode, setMode, when, canSubmit, onSubmit, connected, inviteSettings }: any) {
  const [guestInput, setGuestInput] = useState("");
  const addGuest = () => {
    const e = guestInput.trim();
    if (e && /@/.test(e) && !draft.guests.includes(e)) {
      setDraft({ ...draft, guests: [...draft.guests, e] });
      setGuestInput("");
    }
  };
  const removeGuest = (g: string) => setDraft({ ...draft, guests: draft.guests.filter((x: string) => x !== g) });

  const input = "border border-line rounded-md px-3 py-2 text-[13px] text-body outline-none focus:border-primary bg-white w-full";
  const previewNote = inviteSettings.noteTemplate
    .replace("{{candidate}}", draft.name.trim().split(/\s+/)[0] || "there")
    .replace("{{role}}", draft.role)
    .replace("{{location}}", draft.location)
    .replace("{{time}}", when || "the scheduled time");

  return (
    <div className="fixed inset-0 z-50 bg-black/35 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-[560px] my-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <h3 className="m-0 text-[15px] font-semibold text-head">Schedule interview</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-md text-muted hover:bg-rowhover flex items-center justify-center"><IconX size={18} /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[68vh] overflow-y-auto">
          {/* mode */}
          <div className="inline-flex p-0.5 bg-[#eef2f7] rounded-md">
            <button onClick={() => setMode("existing")} className={`px-3 py-1.5 rounded-[5px] text-[12.5px] font-medium ${mode === "existing" ? "bg-white text-primary shadow-sm" : "text-muted"}`}>Existing candidate</button>
            <button onClick={() => setMode("new")} className={`px-3 py-1.5 rounded-[5px] text-[12.5px] font-medium ${mode === "new" ? "bg-white text-primary shadow-sm" : "text-muted"}`}>New candidate</button>
          </div>

          {mode === "existing" ? (
            <Field label="Candidate">
              <select className={input} value={draft.applicantId} onChange={(e) => setDraft({ ...draft, applicantId: e.target.value })}>
                {ACTIVE_APPLICANTS.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.role}</option>)}
              </select>
            </Field>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Full name"><input className={input} placeholder="Jordan Smith" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
              <Field label="Email"><input className={input} type="email" placeholder="jordan@email.com" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
              <Field label="Role">
                <select className={input} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Date"><input className={input} type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></Field>
            <Field label="Time"><input className={input} type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></Field>
            <Field label="Duration">
              <select className={input} value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })}>
                {["30 min", "45 min", "60 min"].map((d) => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select className={input} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as InterviewType })}>
                {(["In-person", "Video", "Phone"] as InterviewType[]).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          {draft.type === "Video" ? (
            <div className="rounded-md border border-line bg-page p-3">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-[12.5px] font-medium text-head inline-flex items-center gap-1.5"><IconVideo size={15} className="text-primary" /> Add {meetProviderLabel(connected)} link</span>
                <input type="checkbox" checked={draft.addMeet} onChange={(e) => setDraft({ ...draft, addMeet: e.target.checked })} className="accent-[#123FB9]" />
              </label>
              {draft.addMeet && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex-1 text-[12.5px] font-mono text-primary truncate">{draft.meetLink}</span>
                  <button onClick={() => setDraft({ ...draft, meetLink: genMeet(connected) })} className="text-[11.5px] px-2 py-1 rounded border border-line text-muted hover:bg-rowhover">Regenerate</button>
                </div>
              )}
            </div>
          ) : (
            <Field label="Location">
              <input className={input} value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
            </Field>
          )}

          <Field label="Interviewer"><input className={input} value={draft.interviewer} onChange={(e) => setDraft({ ...draft, interviewer: e.target.value })} /></Field>

          {/* guests */}
          <Field label="Add guests">
            <div className="flex gap-2">
              <input
                className={input}
                type="email"
                placeholder="colleague@email.com"
                value={guestInput}
                onChange={(e) => setGuestInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGuest(); } }}
              />
              <button onClick={addGuest} className="px-3 py-2 text-[13px] rounded-md border border-line text-body hover:bg-rowhover whitespace-nowrap">Add</button>
            </div>
            {draft.guests.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {draft.guests.map((g: string) => (
                  <span key={g} className="inline-flex items-center gap-1.5 text-[12px] bg-[#e8f1ff] text-primary px-2 py-1 rounded-full">
                    {g}
                    <button onClick={() => removeGuest(g)} className="text-primary/70 hover:text-primary"><IconX size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </Field>

          {/* notes */}
          <Field label="Notes">
            <textarea className={`${input} h-[68px] resize-none leading-relaxed`} placeholder="Internal notes or agenda for this interview…" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </Field>

          {mode === "new" && (
            <>
              <label className="flex items-center gap-2 text-[12.5px] text-body cursor-pointer">
                <input type="checkbox" checked={draft.sendInvite} onChange={(e) => setDraft({ ...draft, sendInvite: e.target.checked })} className="accent-[#123FB9]" />
                <IconUserPlus size={15} className="text-primary" />
                Queue an email invite to join JewelHire and apply before the interview
              </label>
              {draft.sendInvite && (
                <div className="rounded-md border border-line bg-page p-3 text-[12.5px] text-body leading-relaxed">
                  <div className="text-[11px] uppercase tracking-wide text-muted mb-1">Invite preview</div>
                  {previewNote}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-3.5 border-t border-line">
            <span className="text-[11.5px] text-muted inline-flex items-center gap-1.5 flex-wrap">
              <IconCalendar size={13} /> {connected ? `Adds to ${PROVIDER_LABEL[connected as keyof typeof PROVIDER_LABEL]}` : "No calendar connected"}
            <span className="inline-flex items-center gap-1"><IconMail size={12} /> Email queue from {inviteSettings.account}</span>
          </span>
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-[13px] rounded-md border border-line text-body hover:bg-rowhover">Cancel</button>
            <button onClick={onSubmit} disabled={!canSubmit} className={`inline-flex items-center gap-1.5 px-4 py-2 text-[13px] ${canSubmit ? "btn-grad" : "rounded-md bg-[#cfd6e0] text-white cursor-not-allowed"}`}>
              {mode === "new" && draft.sendInvite ? <><IconSend size={15} /> Schedule &amp; invite</> : "Schedule"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <label className="text-[11.5px] font-medium text-head mb-1">{label}</label>
      {children}
    </div>
  );
}

function Row({ i, onComplete, onNoShow }: { i: Interview; onComplete?: () => void; onNoShow?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="w-[34px] h-[34px] rounded-full bg-[#e8f1ff] flex items-center justify-center text-[12px] font-bold text-primary">{i.initials}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {i.linkable ? (
            <Link href={`/applicants/${i.applicantId}`} className="font-semibold text-head text-[14px] no-underline hover:text-primary">{i.name}</Link>
          ) : (
            <span className="font-semibold text-head text-[14px]">{i.name}</span>
          )}
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${TYPE_STYLE[i.type]}`}>{i.type}</span>
        </div>
        <div className="text-[12px] text-muted">{i.role} · {i.interviewer}{i.notes ? ` · ${i.notes}` : ""}</div>
        {(i.meetLink || (i.guests && i.guests.length > 0)) && (
          <div className="flex items-center gap-3 mt-0.5 text-[11.5px]">
            {i.meetLink && <span className="inline-flex items-center gap-1 text-primary"><IconVideo size={12} /> {i.meetLink}</span>}
            {i.guests && i.guests.length > 0 && <span className="inline-flex items-center gap-1 text-muted"><IconUserPlus size={12} /> +{i.guests.length} guest{i.guests.length === 1 ? "" : "s"}</span>}
          </div>
        )}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span className="text-[13px] text-head font-medium">{i.when}</span>
        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[i.status]}`}>{i.status}</span>
        {onComplete && (
          <div className="flex gap-1.5">
            <button onClick={onComplete} title="Mark completed" className="w-8 h-8 rounded-md border border-line text-muted hover:bg-rowhover hover:text-[#0f6e56] flex items-center justify-center"><IconCheck size={16} /></button>
            <button onClick={onNoShow} title="No-show" className="w-8 h-8 rounded-md border border-line text-muted hover:bg-rowhover hover:text-[#9a6a12] flex items-center justify-center"><IconX size={16} /></button>
          </div>
        )}
      </div>
    </div>
  );
}
