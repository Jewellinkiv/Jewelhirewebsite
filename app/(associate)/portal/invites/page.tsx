"use client";

import { useEffect, useState } from "react";
import { Panel, Radar, MixBars } from "@/components/ui";
import { ASSOC_INVITES, AssociateInvite } from "@/lib/associate-portal";
import { ADJECTIVES, score, PROFILES, GemMatchResult } from "@/lib/gemmatch";
import { IconClipboardList, IconCheck, IconX, IconDiamond, IconChevronRight } from "@/components/icons";

const STATUS_STYLE: Record<string, string> = {
  "To do": "bg-[#fff4e2] text-[#9a6a12]",
  "In progress": "bg-[#e8f1ff] text-primary",
  Completed: "bg-[#e1f5ee] text-[#0f6e56]",
};

interface ApiInvite {
  id: string;
  kind: AssociateInvite["kind"];
  status: "sent" | "started" | "completed" | "expired" | "cancelled";
  sentAt?: string;
  createdAt?: string;
  job?: { title: string };
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

function toInvite(item: ApiInvite): AssociateInvite {
  return {
    id: item.id,
    store: "Sissy's Log Cabin",
    role: item.job?.title || "Jewelry role",
    kind: item.kind,
    sentAt: formatDate(item.sentAt || item.createdAt),
    status: statusLabel(item.status),
    estMinutes: item.kind === "GemMatch" ? 3 : 10,
  };
}

export default function InvitesPage() {
  const [seed, setSeed] = useState<AssociateInvite[]>(ASSOC_INVITES);
  const [active, setActive] = useState<AssociateInvite | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/applicant/invites")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Unable to load invites"))))
      .then((body) => {
        if (!cancelled) setSeed((body.items || []).map(toInvite));
      })
      .catch(() => {
        if (!cancelled) setSeed(ASSOC_INVITES);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const list: AssociateInvite[] = seed;
  const complete = async (invite: AssociateInvite) => {
    if (invite.kind === "GemMatch") {
      await fetch("/api/gemmatch/responses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId: invite.id, pickedAdjectiveIds: [] }),
      }).catch(() => undefined);
    }
    setSeed((l) => l.map((i) => (i.id === invite.id ? { ...i, status: "Completed" } : i)));
  };
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
                  <div className="text-[13.5px] font-semibold text-head">{i.kind} · {i.store}</div>
                  <div className="text-[12px] text-muted">{i.role} · ~{i.estMinutes} min · sent {i.sentAt}</div>
                </div>
                <span className={`ml-auto text-[11px] font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[i.status]}`}>{i.status}</span>
                <button onClick={() => setActive(i)} className="btn-grad inline-flex items-center gap-1 px-3 py-1.5 text-[12.5px]">
                  {i.status === "In progress" ? "Continue" : "Start"} <IconChevronRight size={14} />
                </button>
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
                <div className="text-[13px] text-head font-medium">{i.kind} · {i.store}</div>
                <span className="ml-auto text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#e1f5ee] text-[#0f6e56]">Completed</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-muted text-[13px]">Nothing completed yet.</div>
        )}
      </Panel>

      {active && <TakeModal key={active.id} invite={active} onClose={() => setActive(null)} onDone={() => { complete(active); setActive(null); }} />}
    </div>
  );
}

function TakeModal({ invite, onClose, onDone }: { invite: AssociateInvite; onClose: () => void; onDone: () => void }) {
  const isGem = invite.kind === "GemMatch";
  const [picked, setPicked] = useState<string[]>([]);
  const [result, setResult] = useState<GemMatchResult | null>(null);

  const toggle = (t: string) => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : p.length < 10 ? [...p, t] : p));
  const submit = () => { if (isGem) setResult(score(picked)); else onDone(); };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-[620px] my-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <h3 className="m-0 text-[15px] font-semibold text-head">{invite.kind} · {invite.store}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-md text-muted hover:bg-rowhover flex items-center justify-center"><IconX size={18} /></button>
        </div>

        <div className="p-5">
          {result ? (
            <div>
              <div className="text-center mb-3">
                <div className="text-[12px] text-muted">Your GemMatch profile</div>
                <div className="text-[22px] font-semibold text-head">{result.type}</div>
                <div className="text-[12.5px] text-muted">{result.clarity}</div>
              </div>
              <div className="max-w-[220px] mx-auto mb-3"><Radar mix={result.mix} /></div>
              <MixBars mix={result.mix} />
              <button onClick={onDone} className="btn-grad w-full mt-4 py-2.5 text-[13px] inline-flex items-center justify-center gap-1.5"><IconCheck size={15} /> Submit to {invite.store}</button>
            </div>
          ) : isGem ? (
            <div>
              <p className="m-0 mb-3 text-[13px] text-body">Pick the <b>10 words</b> that best describe you. <span className="text-muted">({picked.length}/10)</span></p>
              <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto">
                {ADJECTIVES.map((a) => {
                  const on = picked.includes(a.text);
                  return (
                    <button key={a.text} onClick={() => toggle(a.text)} className={`px-3 py-1.5 rounded-full text-[12.5px] border ${on ? "text-white border-transparent" : "bg-white border-line text-body hover:bg-rowhover"}`} style={on ? { background: PROFILES[a.profile].color } : undefined}>
                      {a.text}
                    </button>
                  );
                })}
              </div>
              <button onClick={submit} disabled={picked.length !== 10} className={`w-full mt-4 py-2.5 text-[13px] inline-flex items-center justify-center gap-1.5 ${picked.length === 10 ? "btn-grad" : "rounded-md bg-[#cfd6e0] text-white cursor-not-allowed"}`}>See my result</button>
            </div>
          ) : (
            <div>
              <p className="m-0 mb-4 text-[13px] text-body">This {invite.kind.toLowerCase()} takes about {invite.estMinutes} minutes. Your answers go only to {invite.store}.</p>
              <button onClick={onDone} className="btn-grad w-full py-2.5 text-[13px] inline-flex items-center justify-center gap-1.5"><IconCheck size={15} /> Mark complete</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
