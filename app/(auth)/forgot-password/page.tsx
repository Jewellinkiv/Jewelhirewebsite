"use client";

import { useState } from "react";
import { IconDiamond } from "@/components/icons";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    // Always show the same confirmation — the endpoint never reveals whether the
    // email has an account.
    try {
      await fetch("/api/auth/password/reset-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // ignore — still show the neutral confirmation
    }
    setSent(true);
    setSubmitting(false);
  };

  return (
    <main className="min-h-screen bg-page flex items-center justify-center px-5 py-10">
      <section className="w-full max-w-[420px] bg-white border border-line rounded-lg shadow-sm p-8">
        <div className="flex items-center gap-2.5 mb-7">
          <span className="w-9 h-9 rounded-[9px] bg-brand-grad text-white flex items-center justify-center"><IconDiamond size={20} /></span>
          <span className="text-[20px] text-head font-medium">Jewel<span className="font-extrabold">Hire</span></span>
        </div>

        {sent ? (
          <>
            <h1 className="text-[24px] leading-tight font-extrabold text-head m-0">Check your email</h1>
            <p className="text-[14px] text-muted leading-relaxed mt-3 mb-6">
              If an account exists for <span className="text-head font-medium">{email.trim()}</span>, we&apos;ve sent a link to reset your password. It expires in 60 minutes.
            </p>
            <a href="/login" className="btn-grad w-full inline-flex items-center justify-center px-5 py-3 text-[14px] no-underline">Back to sign in</a>
          </>
        ) : (
          <>
            <h1 className="text-[24px] leading-tight font-extrabold text-head m-0">Reset your password</h1>
            <p className="text-[14px] text-muted leading-relaxed mt-3 mb-6">Enter your email and we&apos;ll send you a link to set a new password.</p>
            <form onSubmit={submit} className="space-y-3">
              <label className="block">
                <span className="block text-[12px] font-semibold text-muted mb-1">Email</span>
                <input
                  autoComplete="email"
                  className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-brand"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@store.com"
                  required
                  type="email"
                />
              </label>
              <button className="btn-grad w-full inline-flex items-center justify-center px-5 py-3 text-[14px] disabled:opacity-60" disabled={submitting} type="submit">
                {submitting ? "Sending…" : "Send reset link"}
              </button>
              <div className="text-center"><a href="/login" className="text-[12.5px] text-primary no-underline hover:underline">Back to sign in</a></div>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
