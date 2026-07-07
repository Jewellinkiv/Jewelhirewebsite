"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common";
import { Panel } from "@/components/ui";
import { APPLICANTS, AppStatus, ApplicantNote } from "@/lib/applicants";
import { IconSearch, IconFileText, IconChevronDown, IconUser } from "@/components/icons";
import { useActiveStoreId } from "@/lib/client-session";

const STATUS_STYLE: Record<AppStatus, string> = {
  Active: "bg-[#e8f1ff] text-primary",
  Hired: "bg-[#dff3e8] text-[#0f6e56]",
  Rejected: "bg-[#fcebeb] text-[#a32d2d]",
  Withdrawn: "bg-[#eef2f7] text-[#5b6472]",
};

const FALLBACK_STORE_ID = "store-sissys-little-rock";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatNote(note: { authorUserId: string; createdAt: string; body: string }): ApplicantNote {
  return {
    author: note.authorUserId === "user-hiring-manager" ? "William Jones" : note.authorUserId,
    when: formatDate(note.createdAt),
    text: note.body,
  };
}

function fromApi(row: any) {
  return {
    id: row.id,
    linkable: true,
    name: row.name,
    initials: row.initials,
    role: row.role,
    status: row.status as AppStatus,
    stage: row.stage,
    appliedDate: formatDate(row.appliedDate),
    lastActivity: formatDate(row.lastActivity),
    email: row.email,
    notes: (row.notes || []).map(formatNote),
  };
}

export default function ApplicantsPage() {
  const STORE_ID = useActiveStoreId(FALLBACK_STORE_ID);
  // Start empty (not seeded with demo applicants) so we never flash fake data;
  // real applicants for THIS store load below.
  const [applicants, setApplicants] = useState<typeof APPLICANTS>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"All" | "Active" | "Past">("All");
  const [role, setRole] = useState("All");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, ApplicantNote[]>>({});
  const [draft, setDraft] = useState("");
  const roles = useMemo(() => ["All", ...Array.from(new Set(applicants.map((a) => a.role)))], [applicants]);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    fetch(`/api/stores/${STORE_ID}/applicants`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Unable to load applicants"))))
      .then((body) => {
        if (cancelled) return;
        const next = (body.items || []).map(fromApi);
        setApplicants(next);
        setNotes(Object.fromEntries(next.map((a: typeof APPLICANTS[number]) => [a.id, a.notes])));
        if (next.length > 0) setOpenId(next[0].id);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [STORE_ID]);

  const rows = useMemo(() => {
    return applicants.filter((a) => {
      if (scope === "Active" && a.status !== "Active") return false;
      if (scope === "Past" && a.status === "Active") return false;
      if (role !== "All" && a.role !== role) return false;
      if (q && !`${a.name} ${a.role} ${a.email}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [applicants, q, scope, role]);

  const addNote = async (id: string) => {
    if (!draft.trim()) return;
    const text = draft.trim();
    setNotes((n) => ({ ...n, [id]: [{ author: "William Jones", when: "Just now", text }, ...(n[id] ?? [])] }));
    setDraft("");
    await fetch(`/api/applicants/${id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch(() => undefined);
  };

  return (
    <div>
      <PageHeader
        title="Applicant search"
        subtitle="Search every applicant to your store — past and present — and log notes & history."
      />

      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <div className="flex items-center gap-2 bg-panel border border-line rounded-md px-3 py-2 min-w-[240px] flex-1 max-w-[380px]">
          <IconSearch size={16} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, role, or email…" className="bg-transparent outline-none text-[13px] w-full text-body" />
        </div>
        <div className="flex gap-1.5">
          {(["All", "Active", "Past"] as const).map((s) => (
            <button key={s} onClick={() => setScope(s)} className={`text-[12.5px] px-3 py-2 rounded-md border ${scope === s ? "bg-[#e8f1ff] border-primary text-primary font-medium" : "bg-panel border-line text-body hover:bg-rowhover"}`}>{s}</button>
          ))}
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="border border-line rounded-md bg-panel text-[13px] text-body px-2.5 py-2 outline-none focus:border-primary">
          {roles.map((r) => <option key={r} value={r}>{r === "All" ? "Role: all" : r}</option>)}
        </select>
        <span className="text-[12.5px] text-muted ml-auto">{rows.length} of {applicants.length}</span>
      </div>

      <Panel>
        <div className="divide-y divide-[#eef1f6]">
          {rows.map((a) => {
            const open = openId === a.id;
            const list = notes[a.id] ?? [];
            return (
              <div key={a.id}>
                <button onClick={() => { setDraft(""); setOpenId(open ? null : a.id); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-rowhover">
                  <span className="w-[34px] h-[34px] rounded-full bg-[#e8f1ff] flex items-center justify-center text-[12px] font-bold text-primary">{a.initials}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-head text-[14px]">{a.name}</span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[a.status]}`}>{a.status}</span>
                    </div>
                    <div className="text-[12px] text-muted">{a.role} · applied {a.appliedDate}</div>
                  </div>
                  <div className="ml-auto flex items-center gap-4 text-[12px] text-muted">
                    <span className="inline-flex items-center gap-1"><IconFileText size={14} /> {list.length}</span>
                    <span className="hidden sm:inline">{a.lastActivity}</span>
                    <IconChevronDown size={16} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
                  </div>
                </button>

                {open && (
                  <div className="px-4 pb-4 pl-[58px]">
                    <div className="flex items-center gap-3 mb-3 text-[12.5px]">
                      <Link href={`/applicants/${a.id}`} className="inline-flex items-center gap-1.5 text-primary no-underline font-medium"><IconUser size={14} /> Open full profile</Link>
                      <span className="text-muted">{a.email}</span>
                    </div>

                    {/* add note */}
                    <div className="flex gap-2 mb-3">
                      <input
                        value={open ? draft : ""}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addNote(a.id); }}
                        placeholder="Add a note…"
                        className="flex-1 border border-line rounded-md px-3 py-2 text-[13px] text-body outline-none focus:border-primary bg-white"
                      />
                      <button onClick={() => addNote(a.id)} className="btn-grad px-4 py-2 text-[13px]">Add</button>
                    </div>

                    {/* notes history */}
                    <div className="flex flex-col gap-2">
                      {list.length === 0 && <div className="text-[12.5px] text-muted">No notes yet.</div>}
                      {list.map((n, i) => (
                        <div key={i} className="border border-line rounded-md px-3 py-2.5 bg-white">
                          <div className="text-[13px] text-body leading-relaxed">{n.text}</div>
                          <div className="text-[11.5px] text-muted mt-1">{n.author} · {n.when}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!loaded && <div className="px-4 py-10 text-center text-muted text-[13px]">Loading applicants…</div>}
          {loaded && rows.length === 0 && <div className="px-4 py-10 text-center text-muted text-[13px]">No applicants match your search.</div>}
        </div>
      </Panel>
    </div>
  );
}
