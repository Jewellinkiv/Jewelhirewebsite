"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconCheck, IconChevronDown, IconChevronLeft, IconChevronUp } from "@/components/icons";
import type { JobLocationScope } from "@/lib/job-location-targeting";
import { currentLegalConsentPayload } from "@/lib/legal";

type PublicApplicationDraft = {
  name: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  summary: string;
  skills: string;
  experience: string;
  education: string;
};

const EMPTY_DRAFT: PublicApplicationDraft = {
  name: "",
  email: "",
  phone: "",
  location: "",
  headline: "",
  summary: "",
  skills: "",
  experience: "",
  education: "",
};
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

function validDraft(value: unknown): Partial<PublicApplicationDraft> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.keys(EMPTY_DRAFT)
      .filter((key) => typeof (value as Record<string, unknown>)[key] === "string")
      .map((key) => [key, String((value as Record<string, unknown>)[key]).slice(0, 8_000)]),
  );
}

// Public, account-free application flow. Contact details are saved only in this
// browser's session so an accidental mobile refresh does not erase the form.
// Legal consent is intentionally never persisted or pre-checked.
export function PublicApplyForm({
  storeSlug,
  jobId,
  jobTitle,
  storeName,
  locations,
  jobLocationScope,
  jobLocationIds,
}: {
  storeSlug: string;
  jobId: string;
  jobTitle: string;
  storeName: string;
  locations: Array<{ id: string; name: string }>;
  jobLocationScope?: JobLocationScope;
  jobLocationIds?: string[];
}) {
  const [form, setForm] = useState<PublicApplicationDraft>(EMPTY_DRAFT);
  const [step, setStep] = useState<1 | 2>(1);
  const [showExtra, setShowExtra] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [error, setError] = useState("");
  const [stepError, setStepError] = useState("");
  const [website, setWebsite] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState("");
  const [preferredLocationScope, setPreferredLocationScope] = useState<"any" | "selected">("any");
  const [preferredLocationIds, setPreferredLocationIds] = useState<string[]>([]);
  const idempotencyKey = useRef("");
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const draftRestored = useRef(false);
  const storageKey = `jewelhire:application-draft:${storeSlug}:${jobId}`;

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const saved = sessionStorage.getItem(storageKey);
        if (saved) setForm((current) => ({ ...current, ...validDraft(JSON.parse(saved)) }));
      } catch {
        // Private browsing/storage restrictions should never block applying.
      } finally {
        draftRestored.current = true;
      }
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [storageKey]);

  useEffect(() => {
    if (!draftRestored.current) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(form));
    } catch {
      // The form remains fully usable when session storage is unavailable.
    }
  }, [form, storageKey]);

  const set = (key: keyof PublicApplicationDraft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setStepError("");
  };

  const participatingLocations = jobLocationScope === "all"
    ? locations
    : locations.filter((location) => jobLocationIds?.includes(location.id));
  const requiresLocationPreference = participatingLocations.length > 0;
  const hasLocationPreference = !requiresLocationPreference
    || preferredLocationScope === "any"
    || preferredLocationIds.length > 0;
  const emailIsValid = /^\S+@\S+\.\S+$/.test(form.email.trim());
  const canContinue = form.name.trim().length > 0 && emailIsValid && hasLocationPreference;
  const canSubmit = canContinue && legalAccepted;

  const setLocationPreferenceScope = (scope: "any" | "selected") => {
    setPreferredLocationScope(scope);
    setStepError("");
  };

  const togglePreferredLocation = (locationId: string) => {
    setPreferredLocationIds((current) => current.includes(locationId)
      ? current.filter((id) => id !== locationId)
      : [...current, locationId]);
    setStepError("");
  };

  const focusStep = () => requestAnimationFrame(() => stepHeading.current?.focus());

  const continueToReview = () => {
    if (!form.name.trim()) {
      setStepError("Enter your full name to continue.");
      document.getElementById("pa-name")?.focus();
      return;
    }
    if (!emailIsValid) {
      setStepError("Enter a valid email address to continue.");
      document.getElementById("pa-email")?.focus();
      return;
    }
    if (requiresLocationPreference && preferredLocationScope === "selected" && preferredLocationIds.length === 0) {
      setStepError("Choose at least one preferred store, or select any participating store.");
      document.getElementById("pa-location-preference")?.focus();
      return;
    }
    setStepError("");
    setStep(2);
    focusStep();
  };

  const returnToContact = () => {
    setError("");
    setStep(1);
    focusStep();
  };

  const chooseResume = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setResumeError("");
    setResumeFile(null);
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".pdf") && !lowerName.endsWith(".docx")) {
      setResumeError("Choose a PDF or DOCX résumé.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      setResumeError("Your résumé must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    setResumeFile(file);
  };

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      idempotencyKey.current ||= globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const payload = JSON.stringify({
        jobId,
        website,
        locationPreference: {
          scope: requiresLocationPreference && preferredLocationScope === "selected" ? "selected" : "any",
          locationIds: requiresLocationPreference && preferredLocationScope === "selected" ? preferredLocationIds : [],
        },
        ...currentLegalConsentPayload(),
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
      });
      const headers: Record<string, string> = { "idempotency-key": idempotencyKey.current };
      let body: BodyInit = payload;
      if (resumeFile) {
        const multipart = new FormData();
        multipart.set("payload", payload);
        multipart.set("resume", resumeFile, resumeFile.name);
        body = multipart;
      } else {
        headers["content-type"] = "application/json";
      }
      const response = await fetch(`/api/public/stores/${storeSlug}/applications`, { method: "POST", headers, body });
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof responseBody.error === "string" ? responseBody.error : responseBody.error?.message || "Unable to submit application");
      }
      setConfirmationEmailSent(responseBody.candidateNotification?.status === "sent");
      try {
        sessionStorage.removeItem(storageKey);
      } catch {}
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (step === 1) continueToReview();
    else void submit();
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-line bg-white px-5 py-10 text-center sm:px-6">
        <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#e1f5ee] text-[#0f6e56]"><IconCheck size={26} /></span>
        <h3 className="m-0 text-[20px] font-semibold text-head">Application sent</h3>
        <p className="mx-auto mb-0 mt-2 max-w-[420px] text-[14px] leading-6 text-body">
          Your application for <span className="font-medium text-head">{jobTitle}</span> is on its way to {storeName}.
          {confirmationEmailSent
            ? " We emailed you a confirmation—watch your inbox for assessments or interview invites."
            : " The hiring team will contact you at the email address you provided with any assessments or interview updates."}
        </p>
        <Link href={`/careers/${storeSlug}`} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 text-[13px] font-semibold text-primary no-underline">Back to all roles</Link>
      </div>
    );
  }

  const input = "min-h-11 w-full rounded-md border border-line bg-white px-3 py-2.5 text-[16px] text-body outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-[14px]";
  const label = "mb-1.5 block text-[13px] font-medium text-head";

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-line bg-white px-4 py-5 sm:px-6 sm:py-6" noValidate>
      <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="pa-website">Website</label>
        <input id="pa-website" name="website" value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" />
      </div>

      <div className="mb-6" aria-label={`Application step ${step} of 2`}>
        <div className="flex items-center justify-between gap-3 text-[12px] font-semibold">
          <span className={step === 1 ? "text-primary" : "text-[#0f6e56]"}>{step === 1 ? "1. Your details" : "✓ Your details"}</span>
          <span className={step === 2 ? "text-primary" : "text-muted"}>2. Review &amp; send</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1" aria-hidden="true">
          <span className="h-1 rounded-full bg-primary" />
          <span className={`h-1 rounded-full ${step === 2 ? "bg-primary" : "bg-[#dfe4ec]"}`} />
        </div>
      </div>

      {step === 1 ? (
        <section aria-labelledby="application-contact-heading">
          <h3 ref={stepHeading} id="application-contact-heading" tabIndex={-1} className="m-0 text-[18px] font-semibold text-head outline-none">Start with the essentials</h3>
          <p className="mb-5 mt-1 text-[13px] leading-5 text-muted">No account required. This usually takes less than two minutes.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="pa-name">Full name *</label>
              <input id="pa-name" className={input} value={form.name} onChange={set("name")} autoComplete="name" maxLength={120} required aria-required="true" />
            </div>
            <div>
              <label className={label} htmlFor="pa-email">Email *</label>
              <input id="pa-email" className={input} type="email" value={form.email} onChange={set("email")} autoComplete="email" inputMode="email" maxLength={254} required aria-required="true" />
            </div>
            <div>
              <label className={label} htmlFor="pa-phone">Phone <span className="font-normal text-muted">(optional)</span></label>
              <input id="pa-phone" className={input} type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" inputMode="tel" maxLength={40} />
            </div>
            <div>
              <label className={label} htmlFor="pa-location">City and state <span className="font-normal text-muted">(optional)</span></label>
              <input id="pa-location" className={input} value={form.location} onChange={set("location")} placeholder="Little Rock, AR" autoComplete="address-level2" maxLength={120} />
            </div>
          </div>
          {requiresLocationPreference ? (
            <fieldset className="mt-5 rounded-lg border border-line p-3.5" id="pa-location-preference">
              <legend className="px-1 text-[13px] font-semibold text-head">Which store(s) would you consider? *</legend>
              <p className="mb-3 mt-1 text-[12px] leading-5 text-muted">Choose any participating store, or tell us which locations you prefer for this role.</p>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[13px] text-body">
                <input type="radio" name="preferred-location-scope" checked={preferredLocationScope === "any"} onChange={() => setLocationPreferenceScope("any")} className="h-4 w-4 accent-primary" />
                Any participating store
              </label>
              <label className="mt-1 flex min-h-11 cursor-pointer items-center gap-3 text-[13px] text-body">
                <input type="radio" name="preferred-location-scope" checked={preferredLocationScope === "selected"} onChange={() => setLocationPreferenceScope("selected")} className="h-4 w-4 accent-primary" />
                Choose my preferred store(s)
              </label>
              {preferredLocationScope === "selected" ? (
                <div className="mt-2 grid grid-cols-1 gap-1 border-t border-line pt-2 sm:grid-cols-2">
                  {participatingLocations.map((location) => (
                    <label key={location.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded px-2 text-[13px] text-body hover:bg-page">
                      <input type="checkbox" checked={preferredLocationIds.includes(location.id)} onChange={() => togglePreferredLocation(location.id)} className="h-4 w-4 rounded border-line accent-primary" />
                      {location.name}
                    </label>
                  ))}
                </div>
              ) : null}
            </fieldset>
          ) : null}
          {stepError ? <p className="mb-0 mt-4 text-[13px] text-red-600" role="alert" aria-live="polite">{stepError}</p> : null}
          <button type="submit" className="btn-grad mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full px-8 text-[14px] sm:w-auto">
            Continue
          </button>
          <p className="mb-0 mt-3 text-[12px] text-muted">Your draft stays only in this browser session until you send it.</p>
        </section>
      ) : (
        <section aria-labelledby="application-review-heading">
          <h3 ref={stepHeading} id="application-review-heading" tabIndex={-1} className="m-0 text-[18px] font-semibold text-head outline-none">Review and send</h3>
          <div className="mt-3 flex items-start justify-between gap-4 rounded-lg bg-page px-3.5 py-3">
            <div className="min-w-0 text-[13px] leading-5 text-body">
              <div className="truncate font-semibold text-head">{form.name}</div>
              <div className="truncate">{form.email}</div>
              {form.phone || form.location ? <div className="truncate text-muted">{[form.phone, form.location].filter(Boolean).join(" · ")}</div> : null}
              {requiresLocationPreference ? <div className="truncate text-muted">{preferredLocationScope === "any" ? "Any participating store" : `Preferred: ${participatingLocations.filter((location) => preferredLocationIds.includes(location.id)).map((location) => location.name).join(" · ")}`}</div> : null}
            </div>
            <button type="button" onClick={returnToContact} className="inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-[12px] font-semibold text-primary">
              <IconChevronLeft size={14} /> Edit
            </button>
          </div>

          <div className="mt-5 rounded-lg border border-line p-3.5">
            <label className="block text-[13px] font-semibold text-head" htmlFor="pa-resume">Résumé <span className="font-normal text-muted">(optional)</span></label>
            <p className="mb-3 mt-1 text-[12px] leading-5 text-muted">PDF or DOCX, up to 5 MB. Stored privately with this application.</p>
            <input
              id="pa-resume"
              name="resume"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={chooseResume}
              className="min-h-11 w-full rounded-md border border-line bg-white px-2 py-2 text-[13px] text-body file:mr-3 file:rounded-full file:border-0 file:bg-[#e8f1ff] file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-primary"
            />
            {resumeFile ? <p className="mb-0 mt-2 text-[12px] font-medium text-[#0f6e56]">Selected: {resumeFile.name} ({Math.max(1, Math.round(resumeFile.size / 1024))} KB)</p> : null}
            {resumeError ? <p className="mb-0 mt-2 text-[12px] text-red-600" role="alert" aria-live="polite">{resumeError}</p> : null}
          </div>

          <button type="button" onClick={() => setShowExtra((value) => !value)} className="mt-5 inline-flex min-h-11 items-center gap-1 text-left text-[13px] font-semibold text-primary" aria-expanded={showExtra} aria-controls="application-background-fields">
            {showExtra ? <IconChevronUp size={15} /> : <IconChevronDown size={15} />} Add experience and background <span className="font-normal text-muted">(optional)</span>
          </button>

          {showExtra ? (
            <div id="application-background-fields" className="mt-3 grid grid-cols-1 gap-4">
              <div>
                <label className={label} htmlFor="pa-headline">Professional headline</label>
                <input id="pa-headline" className={input} value={form.headline} onChange={set("headline")} maxLength={180} placeholder="Luxury sales associate with bridal experience" />
              </div>
              <div>
                <label className={label} htmlFor="pa-summary">About you</label>
                <textarea id="pa-summary" className={`${input} min-h-[96px]`} value={form.summary} onChange={set("summary")} maxLength={4000} placeholder="A few sentences about your experience and goals" />
              </div>
              <div>
                <label className={label} htmlFor="pa-skills">Skills</label>
                <input id="pa-skills" className={input} value={form.skills} onChange={set("skills")} maxLength={5000} placeholder="Clienteling, bridal consultation, CRM" />
              </div>
              <div>
                <label className={label} htmlFor="pa-experience">Recent experience</label>
                <textarea id="pa-experience" className={`${input} min-h-[96px]`} value={form.experience} onChange={set("experience")} maxLength={8000} placeholder="Role, company, and a short description" />
              </div>
              <div>
                <label className={label} htmlFor="pa-education">Education</label>
                <input id="pa-education" className={input} value={form.education} onChange={set("education")} maxLength={4000} />
              </div>
            </div>
          ) : null}

          {error ? <p className="mb-0 mt-4 text-[13px] text-red-600" role="alert" aria-live="polite">{error}</p> : null}

          <label className="mt-5 flex items-start gap-3 rounded-lg border border-line p-3.5 text-[12px] leading-relaxed text-body">
            <input type="checkbox" checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} required className="mt-0.5 h-5 w-5 shrink-0 rounded border-line accent-primary" />
            <span>
              I agree to the JewelHire <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary">Terms of Service</Link> and acknowledge the <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary">Privacy Policy</Link>. My application will be shared with {storeName} for hiring purposes.
            </span>
          </label>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <button type="button" onClick={returnToContact} className="inline-flex min-h-11 items-center justify-center rounded-full border border-line px-6 text-[13px] font-semibold text-body">Back</button>
            <button type="submit" disabled={!canSubmit || submitting} className={`inline-flex min-h-11 w-full items-center justify-center rounded-full px-8 text-[14px] sm:w-auto ${canSubmit && !submitting ? "btn-grad" : "cursor-not-allowed bg-[#cfd6e0] font-bold text-white"}`}>
              {submitting ? "Sending application…" : "Send application"}
            </button>
          </div>
          <p className="mb-0 mt-3 text-[12px] text-muted">Shared only with {storeName}. JewelHire does not publish applicant profiles.</p>
        </section>
      )}
    </form>
  );
}
