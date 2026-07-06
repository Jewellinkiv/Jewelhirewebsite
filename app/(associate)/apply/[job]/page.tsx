"use client";

import { useState, use } from "react";
import Link from "next/link";
import { STORE, STORE_JOBS } from "@/lib/public-store";
import { IconCheck, IconDiamond, IconFileText, IconSchool, IconChevronRight } from "@/components/icons";

const STEPS = ["Your info", "Resume", "Review"] as const;
const PUBLIC_STORE_SLUG = "sissys-log-cabin-careers";

// Completed course credentials that appear on the resume (per lifecycle model).
const CREDENTIALS = [
  { title: "Jewelry Basics", issuer: "JewelLink", done: true },
  { title: "Luxury Client Service", issuer: "JewelLink", done: true },
  { title: "Diamonds & the Four C's", issuer: "JewelLink", done: false },
];

export default function ApplyFlow(props: { params: Promise<{ job: string }> }) {
  const params = use(props.params);
  const job = STORE_JOBS.find((j) => j.id === params.job) ?? STORE_JOBS[0];
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showExtra, setShowExtra] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", location: "",
    headline: "", summary: "", skills: "", experience: "", education: "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const canSubmit = form.name.trim().length > 0 && /\S+@\S+\.\S+/.test(form.email);
  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/public/stores/${PUBLIC_STORE_SLUG}/applications`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          profile: {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            location: form.location.trim(),
            headline: form.headline.trim(),
            summary: form.summary.trim(),
            skills: form.skills,
            experience: form.experience,
            education: form.education,
          },
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Unable to submit application");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  const input = "w-full border border-line rounded-md px-3 py-2.5 text-[14px] text-body outline-none focus:border-primary bg-white";
  const label = "text-[12.5px] font-medium text-head mb-1.5 block";

  return (
    <div>
      {/* browser frame */}
      <div className="rounded-[12px] border border-line overflow-hidden shadow-sm bg-white max-w-[820px] mx-auto">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#f1f3f8] border-b border-line">
          <span className="w-3 h-3 rounded-full bg-[#e2683c]" />
          <span className="w-3 h-3 rounded-full bg-[#f0a500]" />
          <span className="w-3 h-3 rounded-full bg-[#1f9e75]" />
          <span className="ml-3 flex-1 max-w-[420px] text-[12px] text-muted bg-white border border-line rounded-md px-3 py-1.5">{STORE.careersUrl}/apply</span>
        </div>

        <div className="p-8">
          {!submitted ? (
            <>
              <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-primary mb-2">Apply · {STORE.name}</div>
              <h1 className="text-[26px] font-extrabold text-head m-0">{job.title}</h1>
              <p className="text-[13px] text-muted mt-1 mb-6">{job.type} · {job.location} · {job.salary}</p>

              {/* stepper */}
              <div className="flex items-center gap-2 mb-7">
                {STEPS.map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      i < step ? "bg-[#1f9e75] text-white" : i === step ? "bg-primary text-white" : "bg-[#eef1f7] text-muted"
                    }`}>{i < step ? <IconCheck size={13} /> : i + 1}</div>
                    <span className={`text-[12.5px] ${i === step ? "font-semibold text-head" : "text-muted"}`}>{s}</span>
                    {i < STEPS.length - 1 && <span className="w-8 h-px bg-line mx-1" />}
                  </div>
                ))}
              </div>

              {/* step 1 */}
              {step === 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className={label}>Full name</label><input className={input} value={form.name} onChange={set("name")} placeholder="Maya Chen" /></div>
                  <div><label className={label}>Email</label><input className={input} value={form.email} onChange={set("email")} placeholder="you@email.com" /></div>
                  <div><label className={label}>Phone</label><input className={input} value={form.phone} onChange={set("phone")} placeholder="(501) 555-0148" /></div>
                  <div><label className={label}>Location</label><input className={input} value={form.location} onChange={set("location")} placeholder="Little Rock, AR" /></div>
                  <div className="sm:col-span-2"><label className={label}>Resume headline</label><input className={input} value={form.headline} onChange={set("headline")} placeholder="Luxury sales & clienteling, 6 years" /></div>
                </div>
              )}

              {/* step 2 */}
              {step === 1 && (
                <div className="flex flex-col gap-5">
                  <div><label className={label}>Professional summary</label><textarea className={`${input} h-24 resize-none`} value={form.summary} onChange={set("summary")} placeholder="A few sentences about your experience and what you love about jewelry…" /></div>
                  <div>
                    <label className={label}>Skills</label>
                    <input className={input} value={form.skills} onChange={set("skills")} placeholder="Clienteling, bridal, CRM, follow-up" />
                  </div>
                  {!showExtra ? (
                    <button onClick={() => setShowExtra(true)} className="flex items-center gap-2 text-[13px] text-primary font-medium border border-dashed border-line rounded-md py-2.5 justify-center hover:bg-rowhover">
                      <IconFileText size={16} /> Add work experience &amp; education
                    </button>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div><label className={label}>Work experience</label><textarea className={`${input} h-20 resize-none`} value={form.experience} onChange={set("experience")} placeholder="Role, company, dates, and what you did…" /></div>
                      <div><label className={label}>Education</label><textarea className={`${input} h-16 resize-none`} value={form.education} onChange={set("education")} placeholder="School, credential, year…" /></div>
                    </div>
                  )}
                  <div className="border border-line rounded-md p-4">
                    <div className="text-[12.5px] font-semibold text-head mb-2 flex items-center gap-1.5"><IconSchool size={15} className="text-primary" /> Courses on your resume</div>
                    <p className="text-[12px] text-muted mb-3">Completed JewelLink courses show on your resume automatically.</p>
                    <div className="flex flex-col gap-2">
                      {CREDENTIALS.map((c) => (
                        <div key={c.title} className="flex items-center gap-2.5 text-[13px]">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center ${c.done ? "bg-[#e1f5ee] text-[#0f6e56]" : "bg-[#eef1f7] text-muted"}`}>{c.done ? <IconCheck size={12} /> : ""}</span>
                          <span className={c.done ? "text-head" : "text-muted"}>{c.title}</span>
                          <span className="text-muted text-[12px]">· {c.issuer}</span>
                          {c.done ? <span className="ml-auto text-[11px] text-[#0f6e56] font-medium">On resume</span> : <span className="ml-auto text-[11px] text-primary font-medium">Take course</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* step 3 */}
              {step === 2 && (
                <div className="flex flex-col gap-4">
                  <div className="border border-line rounded-md p-4">
                    <div className="text-[12px] font-semibold uppercase tracking-wide text-muted mb-2">Applicant</div>
                    <div className="text-[15px] font-bold text-head">{form.name || "Maya Chen"}</div>
                    <div className="text-[13px] text-muted">{form.headline || "Luxury sales & clienteling, 6 years"}</div>
                    <div className="text-[13px] text-muted mt-1">{form.email || "you@email.com"} · {form.location || "Little Rock, AR"}</div>
                  </div>
                  <div className="border border-[#cfe0fb] bg-[#eef4ff] rounded-md p-4">
                    <div className="text-[13px] font-semibold text-primary mb-1.5">What happens next</div>
                    <ul className="m-0 pl-4 text-[13px] text-body leading-relaxed">
                      <li>We&apos;ll email you a short <b>JewelCert</b> assessment (~3 min).</li>
                      <li>You may also receive a <b>JewelCert</b> knowledge check.</li>
                      <li>The hiring team at {STORE.name} reviews your application.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* nav */}
              {error && <div className="mt-5 rounded-md border border-[#f2c2c2] bg-[#fff4f4] px-3 py-2 text-[13px] text-[#a32d2d]">{error}</div>}
              <div className="flex items-center mt-7">
                {step > 0 && (
                  <button onClick={() => setStep(step - 1)} className="btn-outline px-4 py-2.5 text-[13px]">Back</button>
                )}
                {step < STEPS.length - 1 ? (
                  <button onClick={() => setStep(step + 1)} className="btn-grad inline-flex items-center gap-1.5 px-5 py-2.5 text-[14px] ml-auto">Continue <IconChevronRight size={16} /></button>
                ) : (
                  <button onClick={submit} disabled={!canSubmit || submitting} title={canSubmit ? "" : "Add your name and a valid email"} className={`inline-flex items-center gap-1.5 px-5 py-2.5 text-[14px] ml-auto ${canSubmit && !submitting ? "btn-grad" : "rounded-full bg-[#c2cbe0] text-white cursor-not-allowed"}`}><IconCheck size={16} /> {submitting ? "Submitting..." : "Submit application"}</button>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-[#e1f5ee] text-[#0f6e56] flex items-center justify-center mx-auto mb-4"><IconCheck size={32} /></div>
              <h1 className="text-[24px] font-extrabold text-head m-0">Application submitted!</h1>
              <p className="text-[14px] text-body leading-relaxed mt-3 max-w-[440px] mx-auto">
                Thanks for applying to <b>{job.title}</b> at {STORE.name}. We&apos;ve added this to your applicant portal — track its status and complete any assessments there.
              </p>
              <div className="flex items-center justify-center gap-3 mt-6">
                <Link href="/portal/applications" className="btn-grad inline-flex items-center gap-1.5 px-5 py-2.5 text-[13px] no-underline">View your applications <IconChevronRight size={15} /></Link>
                <button onClick={() => { setSubmitted(false); setStep(0); }} className="text-[13px] text-primary font-medium">Start another</button>
              </div>
            </div>
          )}
        </div>

        <div className="px-8 py-4 flex items-center justify-center gap-2 text-[12px] text-muted border-t border-[#eef1f6]">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-brand-grad text-white"><IconDiamond size={13} /></span>
          Powered by JewelHire · JewelLink
        </div>
      </div>
    </div>
  );
}
