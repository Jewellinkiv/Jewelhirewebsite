"use client";

import { useState } from "react";
import { Panel, Radar, TypeLabel } from "@/components/ui";
import { SESSION } from "@/lib/session";
import { GEMMATCH_RESULT } from "@/lib/associate-portal";
import { PROFILES } from "@/lib/gemmatch";
import { IconUser, IconDiamond, IconBell, IconCheck } from "@/components/icons";

const input = "w-full border border-line rounded-md px-3 py-2 text-[13px] text-body outline-none focus:border-primary bg-white";

export default function PortalProfilePage() {
  const [name, setName] = useState(SESSION.name);
  const [email, setEmail] = useState(SESSION.email);
  const [phone, setPhone] = useState("(501) 555-0148");
  const [prefs, setPrefs] = useState({ invites: true, interviews: true, status: true, marketing: false });
  const [saved, setSaved] = useState(false);
  const gm = GEMMATCH_RESULT;

  const toggle = (k: keyof typeof prefs) => { setPrefs((p) => ({ ...p, [k]: !p[k] })); setSaved(false); };

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-head m-0">Profile</h1>
      <p className="mt-1 mb-5 text-muted text-[13.5px]">Your account details, GemMatch result, and what we email you about.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px] items-start">
        <div className="flex flex-col gap-[18px]">
          <Panel title="Account" icon={<IconUser size={16} />}>
            <div className="p-4 space-y-3">
              <Field label="Full name"><input className={input} value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} /></Field>
              <Field label="Email"><input className={input} value={email} onChange={(e) => { setEmail(e.target.value); setSaved(false); }} /></Field>
              <Field label="Phone"><input className={input} value={phone} onChange={(e) => { setPhone(e.target.value); setSaved(false); }} /></Field>
              <button onClick={() => setSaved(true)} className="btn-grad inline-flex items-center gap-1.5 px-4 py-2 text-[13px]">
                {saved ? <><IconCheck size={15} /> Saved</> : "Save changes"}
              </button>
            </div>
          </Panel>

          <Panel title="Notifications" icon={<IconBell size={16} />}>
            <div className="p-4 divide-y divide-[#eef1f6]">
              {([["invites", "New assessment invites"], ["interviews", "Interview invites & changes"], ["status", "Application status updates"], ["marketing", "Tips & product news"]] as const).map(([k, label]) => (
                <label key={k} className="flex items-center justify-between gap-3 py-2 cursor-pointer" onClick={() => toggle(k)}>
                  <span className="text-[12.5px] text-body">{label}</span>
                  <span className={`relative w-9 h-5 rounded-full transition-colors ${prefs[k] ? "bg-primary" : "bg-[#cfd6e0]"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${prefs[k] ? "translate-x-4" : ""}`} />
                  </span>
                </label>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Your GemMatch" icon={<IconDiamond size={16} />}>
          <div className="p-4">
            <div className="text-center mb-2">
              <div className="text-[20px] font-semibold text-head">{gm.type}</div>
              <div className="text-[12.5px]"><TypeLabel primary={gm.primary} type={`${PROFILES[gm.primary].name} · ${PROFILES[gm.secondary].name}`} /></div>
            </div>
            <div className="max-w-[220px] mx-auto"><Radar mix={gm.mix} /></div>
            <p className="text-[12px] text-muted text-center mt-2 mb-0">Shared with a store only when you complete their GemMatch invite.</p>
          </div>
        </Panel>
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
