"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import { IconCalendar, IconMail, IconCheck, IconLink, IconClock } from "@/components/icons";
import { INVITE_SETTINGS } from "@/lib/invite-settings";

type Provider = "google" | "microsoft";

const PROVIDERS: { id: Provider; name: string; sub: string; account: string }[] = [
  { id: "google", name: "Google Calendar", sub: "Gmail / Google Workspace", account: "hiring@sissyslogcabin.com" },
  { id: "microsoft", name: "Microsoft Outlook", sub: "Microsoft 365 / Exchange", account: "hiring@sissyslogcabin.com" },
];

const STORE_ID = "store-sissys-little-rock";

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2 cursor-pointer" onClick={onClick}>
      <span className="text-[12.5px] text-body">{label}</span>
      <span className={`relative w-9 h-5 rounded-full transition-colors ${on ? "bg-primary" : "bg-[#cfd6e0]"}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${on ? "translate-x-4" : ""}`} />
      </span>
    </label>
  );
}

export function CalendarEmailSettings() {
  const [connected, setConnected] = useState<Provider | null>(INVITE_SETTINGS.calendarProvider);
  const [fromName, setFromName] = useState(INVITE_SETTINGS.fromName);
  const [replyTo, setReplyTo] = useState(INVITE_SETTINGS.replyTo);
  const [timezone, setTimezone] = useState(INVITE_SETTINGS.timezone);
  const [duration, setDuration] = useState(INVITE_SETTINGS.defaultDuration);
  const [location, setLocation] = useState(INVITE_SETTINGS.location);
  const [addLinks, setAddLinks] = useState(INVITE_SETTINGS.addLinks);
  const [attachIcs, setAttachIcs] = useState(INVITE_SETTINGS.attachIcs);
  const [remind24, setRemind24] = useState(INVITE_SETTINGS.remind24);
  const [remind1, setRemind1] = useState(INVITE_SETTINGS.remind1);
  const [note, setNote] = useState(INVITE_SETTINGS.noteTemplate);
  const [notice, setNotice] = useState("");

  const input = "border border-line rounded-md px-3 py-2 text-[13px] text-body outline-none focus:border-primary bg-white w-full";
  const activeAccount = PROVIDERS.find((p) => p.id === connected)?.account;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stores/${STORE_ID}/invite-settings`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { inviteSettings: typeof INVITE_SETTINGS }) => {
        if (cancelled) return;
        const settings = data.inviteSettings;
        setConnected(settings.calendarProvider);
        setFromName(settings.fromName);
        setReplyTo(settings.replyTo);
        setTimezone(settings.timezone);
        setDuration(settings.defaultDuration);
        setLocation(settings.location);
        setAddLinks(settings.addLinks);
        setAttachIcs(settings.attachIcs);
        setRemind24(settings.remind24);
        setRemind1(settings.remind1);
        setNote(settings.noteTemplate);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const saveInviteSettings = async (patch: Partial<typeof INVITE_SETTINGS>) => {
    const response = await fetch(`/api/stores/${STORE_ID}/invite-settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        calendarProvider: connected,
        account: activeAccount ?? INVITE_SETTINGS.account,
        fromName,
        replyTo,
        timezone,
        defaultDuration: duration,
        location,
        addLinks,
        attachIcs,
        remind24,
        remind1,
        noteTemplate: note,
        ...patch,
      }),
    });
    if (!response.ok) {
      setNotice("Invite settings could not be saved locally.");
      return;
    }
    setNotice("Invite settings saved.");
  };

  const toggleProvider = async (provider: Provider, on: boolean) => {
    const response = await fetch(`/api/stores/${STORE_ID}/integrations/${provider}`, { method: on ? "DELETE" : "POST" });
    if (!response.ok) {
      setNotice("Calendar connection could not be updated locally.");
      return;
    }
    const data = await response.json() as { inviteSettings: typeof INVITE_SETTINGS };
    setConnected(data.inviteSettings.calendarProvider);
    setNotice(on ? "Calendar disconnected." : `${PROVIDERS.find((p) => p.id === provider)?.name} connected.`);
  };

  const preview = note
    .replace("{{candidate}}", "Jordan")
    .replace("{{role}}", "Sales Associate")
    .replace("{{location}}", "Little Rock")
    .replace("{{time}}", "Thu Jun 25 · 2:30 PM");

  return (
    <Panel title="Calendar & email invites" icon={<IconCalendar size={16} />} className="mb-[18px]">
      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-5">
        {notice && (
          <div className="lg:col-span-2 flex items-center gap-2 bg-[#e1f5ee] border border-[#cdeadd] text-[#0f6e56] rounded-md px-3 py-2 text-[12.5px]">
            <IconCheck size={14} /> {notice}
          </div>
        )}

        {/* left: connections + email */}
        <div className="space-y-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-muted mb-2">Connected calendar</div>
            <div className="space-y-2">
              {PROVIDERS.map((p) => {
                const on = connected === p.id;
                return (
                  <div key={p.id} className={`flex items-center gap-3 rounded-md border px-3 py-2.5 ${on ? "border-accent bg-[#f3f7ff]" : "border-line"}`}>
                    <span className={`w-8 h-8 rounded-md flex items-center justify-center ${on ? "bg-[#e8f1ff] text-primary" : "bg-[#eef2f7] text-muted"}`}><IconCalendar size={16} /></span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-head flex items-center gap-1.5">
                        {p.name}
                        {on && <span className="text-[10.5px] font-medium text-[#0f6e56] bg-[#e1f5ee] px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"><IconCheck size={11} /> Connected</span>}
                      </div>
                      <div className="text-[11.5px] text-muted">{on ? p.account : p.sub}</div>
                    </div>
                    <button
                      onClick={() => toggleProvider(p.id, on)}
                      className={`ml-auto text-[12px] px-3 py-1.5 rounded-md border ${on ? "border-line text-muted hover:bg-rowhover" : "btn-grad border-transparent text-white"}`}
                    >
                      {on ? "Disconnect" : "Connect"}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-[11.5px] text-muted mt-2">Connecting writes interviews to your calendar and reads busy times to avoid double-booking.</p>
          </div>

          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-muted mb-2">Email sender</div>
            <div className="space-y-2.5">
              <div>
                <label className="text-[11.5px] font-medium text-head">From name</label>
                <input className={input} value={fromName} onChange={(e) => setFromName(e.target.value)} />
              </div>
              <div>
                <label className="text-[11.5px] font-medium text-head">Reply-to email</label>
                <input className={input} type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />
              </div>
              <div className="text-[11.5px] text-muted flex items-center gap-1.5">
                <IconMail size={13} /> Invites send from {activeAccount ?? "your connected account"} via {connected === "microsoft" ? "Outlook" : "Gmail"}.
              </div>
            </div>
          </div>
        </div>

        {/* right: preferences + note + preview */}
        <div className="space-y-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-muted mb-2">Invite preferences</div>
            <div className="grid grid-cols-2 gap-2.5 mb-1">
              <div>
                <label className="text-[11.5px] font-medium text-head">Default duration</label>
                <select className={input} value={duration} onChange={(e) => setDuration(e.target.value)}>
                  {["30 min", "45 min", "60 min"].map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11.5px] font-medium text-head">Time zone</label>
                <select className={input} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  {["America/Chicago (CT)", "America/New_York (ET)", "America/Denver (MT)", "America/Los_Angeles (PT)"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-1">
              <label className="text-[11.5px] font-medium text-head">Default location / video link</label>
              <input className={input} value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="divide-y divide-[#eef1f6]">
              <Toggle on={addLinks} onClick={() => setAddLinks(!addLinks)} label="Include add-to-calendar links (Google, Outlook, .ics)" />
              <Toggle on={attachIcs} onClick={() => setAttachIcs(!attachIcs)} label="Attach .ics calendar file to the email" />
              <Toggle on={remind24} onClick={() => setRemind24(!remind24)} label="Email reminder 24 hours before" />
              <Toggle on={remind1} onClick={() => setRemind1(!remind1)} label="Email reminder 1 hour before" />
            </div>
          </div>

          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-muted mb-2">Default invite note</div>
            <textarea className={`${input} h-[84px] resize-none leading-relaxed`} value={note} onChange={(e) => setNote(e.target.value)} />
            <p className="text-[11px] text-muted mt-1">Merge fields: <code>{"{{candidate}}"}</code>, <code>{"{{role}}"}</code>, <code>{"{{location}}"}</code>, <code>{"{{time}}"}</code></p>
            <button onClick={() => saveInviteSettings({})} className="mt-2 btn-grad inline-flex items-center gap-1.5 px-3.5 py-2 text-[12.5px]">
              <IconCheck size={14} /> Save invite defaults
            </button>
          </div>

          {/* live preview */}
          <div className="rounded-md border border-line bg-page overflow-hidden">
            <div className="px-3 py-2 border-b border-line bg-white flex items-center gap-2 text-[12px] text-muted">
              <IconMail size={13} /> Preview · from {fromName}
            </div>
            <div className="p-3 text-[12.5px] text-body leading-relaxed">
              <div className="font-semibold text-head mb-1">Interview invite · Sales Associate</div>
              <p className="m-0 mb-2">{preview}</p>
              <div className="flex items-center gap-1.5 text-[11.5px] text-muted mb-2"><IconClock size={13} /> Thu Jun 25 · 2:30 PM · {duration} · {timezone.split(" ")[0]}</div>
              {addLinks && (
                <div className="flex flex-wrap gap-1.5">
                  {["Google", "Outlook", ".ics"].map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 text-[11px] border border-line bg-white rounded px-2 py-1 text-primary"><IconLink size={12} /> Add to {c}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
