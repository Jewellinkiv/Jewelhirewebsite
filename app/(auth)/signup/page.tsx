"use client";

import { useState } from "react";
import Link from "next/link";
import { IconDiamond } from "@/components/icons";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 3 && email.trim().length <= 320 && !submitting;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/applicant-signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error?.message || "We couldn't send the setup email. Please try again.");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
      setSubmitting(false);
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

        {submitted ? (
          <>
            <h1 className="text-[24px] leading-tight font-extrabold text-head m-0">Check your email</h1>
            <p className="text-[14px] text-muted leading-relaxed mt-3 mb-3">
              If <span className="text-head font-medium break-all">{email.trim()}</span> can be used for JewelHire, we sent the next step.
            </p>
            <p className="text-[13px] text-muted leading-relaxed mt-0 mb-6">
              The secure setup link expires in 60 minutes. Check your spam folder too. No account or password is created until you finish through that link.
            </p>
            <button
              type="button"
              className="w-full rounded-full border border-line bg-white px-5 py-3 text-[14px] font-semibold text-head"
              onClick={() => {
                setSubmitted(false);
                setError("");
              }}
            >
              Request another email
            </button>
            <div className="text-center text-[12.5px] text-muted mt-4">Already have an account? <Link href="/login" className="text-primary no-underline hover:underline">Sign in</Link></div>
          </>
        ) : (
          <>
            <h1 className="text-[24px] leading-tight font-extrabold text-head m-0">Create your applicant account</h1>
            <p className="text-[14px] text-muted leading-relaxed mt-3 mb-6">Start with your email. You&apos;ll choose your name and password only after opening the secure link we send you.</p>
            <form onSubmit={submit} className="space-y-3">
              <label className="block">
                <span className="block text-[12px] font-semibold text-muted mb-1">Email</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  maxLength={320}
                  required
                  className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-brand"
                  placeholder="you@email.com"
                />
              </label>
              {error ? <p className="m-0 text-[12.5px] text-[#a32d2d]">{error}</p> : null}
              <button type="submit" disabled={!canSubmit} className={`w-full py-3 text-[14px] inline-flex items-center justify-center rounded-full ${canSubmit ? "btn-grad" : "bg-[#cfd6e0] text-white font-bold cursor-not-allowed"}`}>
                {submitting ? "Sending…" : "Email my secure setup link"}
              </button>
              <div className="text-center text-[12.5px] text-muted">Already have an account? <Link href="/login" className="text-primary no-underline hover:underline">Sign in</Link></div>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
