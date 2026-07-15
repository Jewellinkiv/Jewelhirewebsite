"use client";

import { useEffect, useState } from "react";
import { Panel, Radar, TypeLabel } from "@/components/ui";
import { useCurrentSessionUser } from "@/lib/client-session";
import { latestCompletedJewelCertResult, type ApplicantJewelCertResult } from "@/lib/applicant-jewelcert-result";
import { PROFILES } from "@/lib/gemmatch";
import { IconUser, IconDiamond, IconBell, IconCheck } from "@/components/icons";

const input = "w-full border border-line rounded-md px-3 py-2 text-[13px] text-body outline-none focus:border-primary bg-white";
const readonlyInput = `${input} bg-[#f8fafc] text-muted`;

type Prefs = { invites: boolean; interviews: boolean; status: boolean; marketing: boolean };

export default function PortalProfilePage() {
  const user = useCurrentSessionUser();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState("");
  const [prefs, setPrefs] = useState<Prefs>({ invites: true, interviews: true, status: true, marketing: false });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPref, setSavingPref] = useState<keyof Prefs | null>(null);
  const [profileError, setProfileError] = useState("");
  const [prefsError, setPrefsError] = useState("");
  const [jewelCert, setJewelCert] = useState<ApplicantJewelCertResult | null>(null);
  const [jewelCertState, setJewelCertState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      fetch("/api/applicant/profile", { cache: "no-store" }).then((response) => (response.ok ? response.json() : Promise.reject())),
      fetch("/api/applicant/notification-prefs", { cache: "no-store" }).then((response) => (response.ok ? response.json() : Promise.reject())),
      fetch("/api/applicant/invites", { cache: "no-store" }).then((response) => (response.ok ? response.json() : Promise.reject())),
    ])
      .then(([profileResult, prefsResult, invitesResult]) => {
        if (cancelled) return;
        if (profileResult.status === "fulfilled") {
          const profile = profileResult.value.profile || {};
          setName(profile.fullName || user.name);
          setEmail(profile.email || user.email);
          setPhone(profile.phone || "");
        } else {
          setProfileError("Profile could not be loaded.");
        }
        if (prefsResult.status === "fulfilled") {
          setPrefs((current) => ({ ...current, ...(prefsResult.value.prefs || {}) }));
        } else {
          setPrefsError("Notification preferences could not be loaded.");
        }
        if (invitesResult.status === "fulfilled") {
          setJewelCert(latestCompletedJewelCertResult(invitesResult.value));
          setJewelCertState("ready");
        } else {
          setJewelCert(null);
          setJewelCertState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user.email, user.name]);

  async function saveProfile() {
    setSaving(true);
    setSaved(false);
    setProfileError("");
    try {
      const response = await fetch("/api/applicant/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: name, phone }),
      });
      if (!response.ok) throw new Error("profile_save_failed");
      const payload = await response.json();
      const profile = payload.profile || {};
      setName(profile.fullName || name);
      setEmail(profile.email || email);
      setPhone(profile.phone || phone);
      setSaved(true);
    } catch {
      setProfileError("Profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(k: keyof Prefs) {
    const next = { ...prefs, [k]: !prefs[k] };
    const previous = prefs;
    setPrefs(next);
    setSaved(false);
    setPrefsError("");
    setSavingPref(k);
    try {
      const response = await fetch("/api/applicant/notification-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [k]: next[k] }),
      });
      if (!response.ok) throw new Error("prefs_save_failed");
      const payload = await response.json();
      setPrefs((current) => ({ ...current, ...(payload.prefs || {}) }));
    } catch {
      setPrefs(previous);
      setPrefsError("Notifications could not be saved.");
    } finally {
      setSavingPref(null);
    }
  }

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-head m-0">Profile</h1>
      <p className="mt-1 mb-5 text-muted text-[13.5px]">Your account details, JewelCert result, and what we email you about.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px] items-start">
        <div className="flex flex-col gap-[18px]">
          <Panel title="Account" icon={<IconUser size={16} />}>
            <div className="p-4 space-y-3">
              <Field label="Full name"><input className={input} value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} /></Field>
              <Field label="Email"><input className={readonlyInput} value={email} readOnly /></Field>
              <Field label="Phone"><input className={input} value={phone} placeholder="Add a phone number" onChange={(e) => { setPhone(e.target.value); setSaved(false); }} /></Field>
              <button onClick={saveProfile} disabled={saving} className="btn-grad inline-flex items-center gap-1.5 px-4 py-2 text-[13px] disabled:opacity-60">
                {saved ? <><IconCheck size={15} /> Saved</> : saving ? "Saving..." : "Save changes"}
              </button>
              {profileError ? <p className="m-0 text-[12px] text-red-600">{profileError}</p> : null}
            </div>
          </Panel>

          <Panel title="Notifications" icon={<IconBell size={16} />}>
            <div className="p-4 divide-y divide-[#eef1f6]">
              {([["invites", "New assessment invites"], ["interviews", "Interview invites & changes"], ["status", "Application status updates"], ["marketing", "Tips & product news"]] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 py-2 text-left disabled:opacity-60"
                  onClick={() => toggle(k)}
                  disabled={savingPref !== null}
                  aria-pressed={prefs[k]}
                >
                  <span className="text-[12.5px] text-body">{label}</span>
                  <span className={`relative w-9 h-5 rounded-full transition-colors ${prefs[k] ? "bg-primary" : "bg-[#cfd6e0]"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${prefs[k] ? "translate-x-4" : ""}`} />
                  </span>
                </button>
              ))}
              {prefsError ? <p className="m-0 pt-3 text-[12px] text-red-600">{prefsError}</p> : null}
            </div>
          </Panel>
        </div>

        <Panel title="Your JewelCert" icon={<IconDiamond size={16} />}>
          <div className="p-4">
            {jewelCertState === "loading" ? (
              <p className="text-[13px] text-muted text-center my-8">Loading your JewelCert result…</p>
            ) : jewelCertState === "error" ? (
              <div className="text-center py-6">
                <div className="text-[14px] font-medium text-head">JewelCert result unavailable</div>
                <p className="text-[12.5px] text-muted mt-1 mb-0">Refresh the page to try again.</p>
              </div>
            ) : jewelCert ? (
              <>
                <div className="text-center mb-2">
                  <div className="text-[20px] font-semibold text-head">{jewelCert.type}</div>
                  <div className="text-[12.5px]"><TypeLabel primary={jewelCert.primary} type={`${PROFILES[jewelCert.primary].name} · ${PROFILES[jewelCert.secondary].name}`} /></div>
                </div>
                <div className="max-w-[220px] mx-auto"><Radar mix={jewelCert.mix} /></div>
                <p className="text-[12px] text-muted text-center mt-2 mb-0">Shared only with the store whose JewelCert you completed.</p>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="text-[14px] font-medium text-head">No completed JewelCert yet</div>
                <p className="text-[12.5px] text-muted mt-1 mb-0">Your result will appear here after you complete a JewelCert invite.</p>
              </div>
            )}
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
