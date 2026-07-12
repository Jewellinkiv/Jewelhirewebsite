"use client";

import { useState } from "react";
import Link from "next/link";
import { IconDiamond } from "@/components/icons";
import { isStrongPassword } from "@/lib/password-policy";
import { currentLegalConsentPayload } from "@/lib/legal";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const strong = isStrongPassword(password);
  const canSubmit = email.trim().length > 3 && strong && legalAccepted && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/auth/applicant-signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email: email.trim(), password, ...currentLegalConsentPayload() }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        setError(body?.error?.message || "We couldn't create your account. Please try again.");
        setSubmitting(false);
        return;
      }
      window.location.href = body?.next || "/portal";
    } catch {
      setError("We couldn't reach the server. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-page flex items-center justify-center px-5 py-10">
      <section className="w-full max-w-[420px] bg-white border border-line rounded-lg shadow-sm p-8">
        <div className="flex items-center gap-2.5 mb-7">
          <span className="w-9 h-9 rounded-[9px] bg-brand-grad text-white flex items-center justify-center"><IconDiamond size={20} /></span>
          <span className="text-[20px] text-head font-medium">Jewel<span className="font-extrabold">Hire</span></span>
        </div>
        <h1 className="text-[24px] leading-tight font-extrabold text-head m-0">Create your applicant account</h1>
        <p className="text-[14px] text-muted leading-relaxed mt-3 mb-6">Free — build your profile, take assessments, and see invites from stores in one place.</p>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="block text-[12px] font-semibold text-muted mb-1">Full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-brand" placeholder="Maya Chen" />
          </label>
          <label className="block">
            <span className="block text-[12px] font-semibold text-muted mb-1">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-brand" placeholder="you@email.com" />
          </label>
          <label className="block">
            <span className="block text-[12px] font-semibold text-muted mb-1">Password</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" required className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-brand" placeholder="At least 12 characters" />
            <span className="block text-[11.5px] text-muted mt-1">12+ characters, with a letter and a number.</span>
          </label>
          {error ? <p className="m-0 text-[12.5px] text-[#a32d2d]">{error}</p> : null}
          <label className="flex items-start gap-2 text-[11.5px] leading-relaxed text-muted">
            <input type="checkbox" checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} required className="mt-0.5 h-4 w-4 accent-primary" />
            <span>I agree to the <Link href="/terms" target="_blank" className="text-primary">Terms of Service</Link> and acknowledge the <Link href="/privacy" target="_blank" className="text-primary">Privacy Policy</Link>.</span>
          </label>
          <button type="submit" disabled={!canSubmit} className={`w-full py-3 text-[14px] inline-flex items-center justify-center rounded-full ${canSubmit ? "btn-grad" : "bg-[#cfd6e0] text-white font-bold cursor-not-allowed"}`}>
            {submitting ? "Creating…" : "Create account"}
          </button>
          <div className="text-center text-[12.5px] text-muted">Already have an account? <Link href="/login" className="text-primary no-underline hover:underline">Sign in</Link></div>
        </form>
      </section>
    </main>
  );
}
