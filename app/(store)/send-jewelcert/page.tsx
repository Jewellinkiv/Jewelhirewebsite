"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common";
import { Panel } from "@/components/ui";
import { CERT_COMPONENTS, CERT_COURSES, CertComponent, CertCourseRef, ComponentKind } from "@/lib/jewelcert";
import { APPLICANTS } from "@/lib/applicants";
import { IconSend, IconDiamond, IconTargetArrow, IconClipboardList, IconSchool, IconCheck } from "@/components/icons";
import { useActiveStoreId } from "@/lib/client-session";

const ACTIVE = APPLICANTS.filter((a) => a.status === "Active");
const FALLBACK_STORE_ID = "store-sissys-little-rock";
const PUBLIC_STORE_SLUG = "sissys-log-cabin-careers";
const DEFAULT_JOB_ID = "job-luxury-sales-associate";

type NotificationStatus = "disabled" | "dry_run" | "sent" | "skipped" | "failed";

type NotificationResult = {
  status?: NotificationStatus;
  reason?: string;
};

type DeliveryNotice = {
  tone: "success" | "warning" | "error";
  title: string;
  body: string;
};

function KindIcon({ kind, size = 18 }: { kind: ComponentKind; size?: number }) {
  if (kind === "gemmatch") return <IconDiamond size={size} />;
  if (kind === "knowledge") return <IconClipboardList size={size} />;
  if (kind === "course") return <IconSchool size={size} />;
  return <IconTargetArrow size={size} />;
}

function deliveryNotice(notification?: NotificationResult): DeliveryNotice {
  if (notification?.status === "sent") {
    return {
      tone: "success",
      title: "Email sent",
      body: "The invite email was accepted by the email provider.",
    };
  }
  if (notification?.status === "dry_run") {
    return {
      tone: "warning",
      title: "Email dry run",
      body: "The invite was created, but email delivery is running in dry-run mode.",
    };
  }
  if (notification?.status === "disabled") {
    return {
      tone: "warning",
      title: "Email disabled",
      body: notification.reason || "The invite was created, but live email delivery is disabled.",
    };
  }
  if (notification?.status === "skipped") {
    return {
      tone: "error",
      title: "Email skipped",
      body: notification.reason || "The invite was created, but no deliverable recipient email was available.",
    };
  }
  if (notification?.status === "failed") {
    return {
      tone: "error",
      title: "Email failed",
      body: notification.reason || "The invite was created, but the email provider did not accept it.",
    };
  }
  return {
    tone: "warning",
    title: "Email status unknown",
    body: "The invite was created, but the email delivery status was not returned.",
  };
}

export default function SendJewelCert() {
  const STORE_ID = useActiveStoreId(FALLBACK_STORE_ID);
  const [components, setComponents] = useState<CertComponent[]>(CERT_COMPONENTS);
  const [courseOptions, setCourseOptions] = useState<CertCourseRef[]>(CERT_COURSES);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [applicantId, setApplicantId] = useState(ACTIVE[0]?.id ?? "");
  const [newC, setNewC] = useState({ first: "", last: "", email: "" });
  const [comps, setComps] = useState<Set<string>>(new Set());
  const [courses, setCourses] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [delivery, setDelivery] = useState<DeliveryNotice | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/jewelcert/components")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { components: CertComponent[]; courses: CertCourseRef[] }) => {
        if (!cancelled) {
          setComponents(data.components);
          setCourseOptions(data.courses);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setComponents(CERT_COMPONENTS);
          setCourseOptions(CERT_COURSES);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (set: Set<string>, id: string, fn: (s: Set<string>) => void) => {
    const next = new Set(set); next.has(id) ? next.delete(id) : next.add(id); fn(next);
  };

  const recipientName = mode === "existing"
    ? ACTIVE.find((a) => a.id === applicantId)?.name ?? "—"
    : `${newC.first} ${newC.last}`.trim() || "New candidate";
  const recipientOk = mode === "existing" ? !!applicantId : !!newC.email.trim();
  const total = comps.size + courses.size;
  const canSend = recipientOk && total > 0;
  const recipientRole = mode === "existing" ? ACTIVE.find((a) => a.id === applicantId)?.role ?? "Sales Associate" : "Sales Associate";

  const send = async () => {
    if (!canSend || sending) return;
    setSending(true);
    setError("");
    setDelivery(null);
    try {
      let applicationId = "";
      if (mode === "existing") {
        const applicant = ACTIVE.find((a) => a.id === applicantId);
        const response = await fetch(`/api/store/applications?q=${encodeURIComponent(applicant?.name || "")}`);
        const body = await response.json();
        applicationId = body.items?.[0]?.application?.id || "";
      } else {
        const name = `${newC.first} ${newC.last}`.trim();
        const response = await fetch(`/api/public/stores/${PUBLIC_STORE_SLUG}/applications`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jobId: DEFAULT_JOB_ID,
            profile: { name, email: newC.email.trim(), headline: recipientRole, summary: "Created from store JewelCert send." },
          }),
        });
        const body = await response.json();
        applicationId = body.applicationId || "";
      }
      if (!applicationId) throw new Error("No matching application found for this recipient");

      const response = await fetch(`/api/stores/${STORE_ID}/jewelcert-invites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          applicationId,
          componentIds: [...comps],
          courseSlugs: [...courses],
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Unable to send JewelCert");
      }
      const body = await response.json().catch(() => ({}));
      setDelivery(deliveryNotice(body.notification));
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send JewelCert");
    } finally {
      setSending(false);
    }
  };

  const input = "w-full border border-line rounded-md px-3 py-2.5 text-[14px] text-body outline-none focus:border-primary bg-white";
  const label = "text-[12px] font-semibold text-head mb-1.5 block";

  if (sent) {
    const deliveryClass =
      delivery?.tone === "success"
        ? "border-[#b9e4d4] bg-[#f0fbf7] text-[#0f6e56]"
        : delivery?.tone === "error"
          ? "border-[#f2c2c2] bg-[#fff4f4] text-[#a32d2d]"
          : "border-[#f2d3aa] bg-[#fff8ec] text-[#8a4b10]";
    return (
      <div>
        <PageHeader title="Send JewelCert" />
        <Panel className="max-w-[560px] mx-auto">
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[#e1f5ee] text-[#0f6e56] flex items-center justify-center mx-auto mb-4"><IconCheck size={28} /></div>
            <h2 className="text-[20px] font-bold text-head m-0">{delivery?.tone === "success" ? "JewelCert sent" : "JewelCert created"}</h2>
            <p className="text-[14px] text-body mt-2 mb-4">{recipientName} has one invite link for {total} item{total === 1 ? "" : "s"}. Progress shows on their pipeline card.</p>
            {delivery && (
              <div className={`mb-5 rounded-md border px-3 py-2 text-left text-[12.5px] ${deliveryClass}`}>
                <div className="font-bold">{delivery.title}</div>
                <div className="mt-0.5">{delivery.body}</div>
              </div>
            )}
            <button onClick={() => { setSent(false); setDelivery(null); setComps(new Set()); setCourses(new Set()); }} className="btn-outline px-4 py-2.5 text-[13px]">Send another</button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Send JewelCert" subtitle="One screening invite. Pick any combination of components — all optional." />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        <div>
          {/* recipient */}
          <Panel title="Recipient" className="mb-4">
            <div className="p-4">
              <div className="flex gap-1.5 mb-3">
                {(["existing", "new"] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)} className={`text-[12.5px] px-3 py-2 rounded-md border ${mode === m ? "bg-[#e8f1ff] border-primary text-primary font-medium" : "bg-panel border-line text-body hover:bg-rowhover"}`}>{m === "existing" ? "Existing applicant" : "New candidate"}</button>
                ))}
              </div>
              {mode === "existing" ? (
                <select className={input} value={applicantId} onChange={(e) => setApplicantId(e.target.value)}>
                  {ACTIVE.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.role}</option>)}
                </select>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <input className={input} placeholder="First name" value={newC.first} onChange={(e) => setNewC({ ...newC, first: e.target.value })} />
                  <input className={input} placeholder="Last name" value={newC.last} onChange={(e) => setNewC({ ...newC, last: e.target.value })} />
                  <input className={input + " col-span-2"} placeholder="Email" value={newC.email} onChange={(e) => setNewC({ ...newC, email: e.target.value })} />
                </div>
              )}
            </div>
          </Panel>

          {/* components */}
          <Panel title="Assessments & profile" action={<span className="text-[11.5px] text-muted">Pick any</span>} className="mb-4">
            <div className="divide-y divide-[#eef1f6]">
              {components.map((c) => {
                const on = comps.has(c.id);
                return (
                  <label key={c.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-rowhover">
                    <input type="checkbox" checked={on} onChange={() => toggle(comps, c.id, setComps)} className="w-4 h-4 accent-[#123FB9]" />
                    <span className={`w-9 h-9 rounded-md flex items-center justify-center ${on ? "bg-[#e8f1ff] text-primary" : "bg-[#f1f3f8] text-muted"}`}><KindIcon kind={c.kind} /></span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold text-head">{c.label}</span>
                      <span className="block text-[12px] text-muted">{c.desc} · {c.meta}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </Panel>

          {/* optional courses */}
          <Panel title="Required courses" action={<span className="text-[11.5px] text-muted">Optional</span>}>
            <div className="divide-y divide-[#eef1f6]">
              {courseOptions.map((c) => {
                const on = courses.has(c.slug);
                return (
                  <label key={c.slug} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-rowhover">
                    <input type="checkbox" checked={on} onChange={() => toggle(courses, c.slug, setCourses)} className="w-4 h-4 accent-[#123FB9]" />
                    <span className={`w-9 h-9 rounded-md flex items-center justify-center ${on ? "bg-[#e8f1ff] text-primary" : "bg-[#f1f3f8] text-muted"}`}><IconSchool size={18} /></span>
                    <span className="text-[13.5px] font-medium text-head">{c.title}</span>
                  </label>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* summary */}
        <Panel title="This JewelCert" className="lg:sticky lg:top-[68px]">
          <div className="p-4">
            <div className="text-[12px] text-muted mb-1">To</div>
            <div className="text-[14px] font-semibold text-head mb-3">{recipientName}</div>
            <div className="text-[12px] text-muted mb-1">Includes</div>
            {total === 0 ? (
              <p className="text-[13px] text-muted m-0">Nothing selected yet — pick at least one component or course.</p>
            ) : (
              <ul className="m-0 pl-0 list-none space-y-1.5">
                {[...comps].map((id) => {
                  const c = components.find((x) => x.id === id)!;
                  return <li key={id} className="flex items-center gap-2 text-[13px] text-body"><IconCheck size={14} className="text-[#0f6e56]" /> {c.label}</li>;
                })}
                {[...courses].map((slug) => {
                  const c = courseOptions.find((x) => x.slug === slug)!;
                  return <li key={slug} className="flex items-center gap-2 text-[13px] text-body"><IconCheck size={14} className="text-[#0f6e56]" /> Course: {c.title}</li>;
                })}
              </ul>
            )}
            {error && <div className="mt-4 rounded-md border border-[#f2c2c2] bg-[#fff4f4] px-3 py-2 text-[12.5px] text-[#a32d2d]">{error}</div>}
            <button disabled={!canSend || sending} onClick={send} className={`w-full mt-4 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-[14px] rounded-full font-bold text-white ${canSend && !sending ? "btn-grad" : "bg-[#c2cbe0] cursor-not-allowed"}`}>
              <IconSend size={16} /> {sending ? "Sending..." : "Send JewelCert"}
            </button>
            <p className="text-[11.5px] text-muted text-center mt-2">The candidate gets a single link for all selected items.</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
