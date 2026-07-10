"use client";

import { useState } from "react";
import Link from "next/link";
import { IconCheck, IconChevronDown, IconChevronUp } from "@/components/icons";

// Public application form (no account needed). Posts to the store-scoped
// public applications API; the store slug + job id come from the server page
// so applications always land in the right store.
export function PublicApplyForm({
  storeSlug,
  jobId,
  jobTitle,
  storeName,
}: {
  storeSlug: string;
  jobId: string;
  jobTitle: string;
  storeName: string;
}) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", location: "",
    headline: "", summary: "", skills: "", experience: "", education: "",
  });
  const [showExtra, setShowExtra] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const canSubmit = form.name.trim().length > 0 && /\S+@\S+\.\S+/.test(form.email);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/public/stores/${storeSlug}/applications`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobId,
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
        throw new Error(typeof body.error === "string" ? body.error : "Unable to submit application");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-white border border-line rounded-xl px-6 py-10 text-center">
        <span className="w-14 h-14 rounded-full bg-[#e1f5ee] text-[#0f6e56] inline-flex items-center justify-center mb-4"><IconCheck size={26} /></span>
        <h3 className="m-0 text-[18px] font-semibold text-head">Application sent</h3>
        <p className="mt-2 mb-0 text-[13.5px] text-body max-w-[420px] mx-auto">
          Your application for <span className="font-medium text-head">{jobTitle}</span> is on its way to {storeName}.
          We emailed you a confirmation — watch your inbox for next steps like assessments or interview invites.
        </p>
        <Link href={`/careers/${storeSlug}`} className="inline-block mt-5 text-[13px] text-primary no-underline">Back to all roles</Link>
      </div>
    );
  }

  const input = "w-full border border-line rounded-md px-3 py-2.5 text-[14px] text-body outline-none focus:border-primary bg-white";
  const label = "text-[12.5px] font-medium text-head mb-1.5 block";

  return (
    <form onSubmit={submit} className="bg-white border border-line rounded-xl px-5 py-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="pa-name">Full name *</label>
          <input id="pa-name" className={input} value={form.name} onChange={set("name")} autoComplete="name" required />
        </div>
        <div>
          <label className={label} htmlFor="pa-email">Email *</label>
          <input id="pa-email" className={input} type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
        </div>
        <div>
          <label className={label} htmlFor="pa-phone">Phone</label>
          <input id="pa-phone" className={input} type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" />
        </div>
        <div>
          <label className={label} htmlFor="pa-location">Location</label>
          <input id="pa-location" className={input} value={form.location} onChange={set("location")} placeholder="City, State" autoComplete="address-level2" />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowExtra((v) => !v)}
        className="mt-4 inline-flex items-center gap-1 text-[13px] text-primary"
      >
        {showExtra ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />} Add experience &amp; background (optional)
      </button>

      {showExtra ? (
        <div className="mt-3 grid grid-cols-1 gap-4">
          <div>
            <label className={label} htmlFor="pa-headline">Headline</label>
            <input id="pa-headline" className={input} value={form.headline} onChange={set("headline")} placeholder="e.g. Luxury sales associate with bridal experience" />
          </div>
          <div>
            <label className={label} htmlFor="pa-summary">Summary</label>
            <textarea id="pa-summary" className={`${input} min-h-[80px]`} value={form.summary} onChange={set("summary")} placeholder="A few sentences about you" />
          </div>
          <div>
            <label className={label} htmlFor="pa-skills">Skills</label>
            <input id="pa-skills" className={input} value={form.skills} onChange={set("skills")} placeholder="Clienteling, bridal consultation, CRM…" />
          </div>
          <div>
            <label className={label} htmlFor="pa-experience">Experience</label>
            <textarea id="pa-experience" className={`${input} min-h-[80px]`} value={form.experience} onChange={set("experience")} placeholder="Most recent roles" />
          </div>
          <div>
            <label className={label} htmlFor="pa-education">Education</label>
            <input id="pa-education" className={input} value={form.education} onChange={set("education")} />
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-4 mb-0 text-[13px] text-red-600">{error}</p> : null}

      {/* own row — as a sibling inline element it rendered on the same line as
          the "Add experience" toggle and overlapped it */}
      <div className="mt-5">
        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className={`w-full sm:w-auto px-8 py-3 text-[14px] rounded-full inline-flex items-center justify-center ${
            canSubmit && !submitting ? "btn-grad" : "bg-[#cfd6e0] text-white font-bold cursor-not-allowed"
          }`}
        >
          {submitting ? "Submitting…" : "Submit application"}
        </button>
      </div>
      <p className="mt-3 mb-0 text-[12px] text-muted">Your application is shared only with {storeName}.</p>
    </form>
  );
}
