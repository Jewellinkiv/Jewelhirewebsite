"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconDiamond } from "@/components/icons";
import { currentLegalConsentPayload } from "@/lib/legal";
import { PASSWORD_MAX_LENGTH, isStrongPassword } from "@/lib/password-policy";

function VerificationForm() {
  const tokenInMemory = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useLayoutEffect(() => {
    // URL fragments never reach the HTTP request or Cloud Run access logs.
    // Retain the one-time token only in this component's memory, then remove
    // the entire fragment (and any legacy query string) before navigation can
    // expose it through browser history or a same-origin Referer header.
    const captureAndScrubToken = () => {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      if (fragment.has("token")) {
        tokenInMemory.current = fragment.get("token") || "";
      } else if (tokenInMemory.current === null) {
        tokenInMemory.current = "";
      }
      window.history.replaceState(window.history.state, "", window.location.pathname);
      setToken(tokenInMemory.current);
    };

    window.addEventListener("hashchange", captureAndScrubToken);
    captureAndScrubToken();
    return () => window.removeEventListener("hashchange", captureAndScrubToken);
  }, []);

  const strong = isStrongPassword(password);
  const canSubmit = Boolean(token)
    && name.trim().length >= 2
    && name.trim().length <= 160
    && strong
    && password === confirm
    && legalAccepted
    && !submitting;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/applicant-signup/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          name: name.trim(),
          password,
          ...currentLegalConsentPayload(),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error?.message || "We couldn't finish setting up your account. Please try again.");
        setSubmitting(false);
        return;
      }
      window.location.href = body?.next || "/portal";
    } catch {
      setError("We couldn't reach the server. Please try again.");
      setSubmitting(false);
    }
  };

  if (token === null) {
    return <p className="text-[14px] text-muted m-0">Loading secure setup…</p>;
  }

  if (!token) {
    return (
      <>
        <h1 className="text-[24px] leading-tight font-extrabold text-head m-0">This setup link isn&apos;t valid</h1>
        <p className="text-[14px] text-muted leading-relaxed mt-3 mb-6">Request a new secure link to create your applicant account.</p>
        <Link href="/signup" className="btn-grad w-full inline-flex items-center justify-center px-5 py-3 text-[14px] no-underline">Request a new link</Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-[24px] leading-tight font-extrabold text-head m-0">Finish your applicant account</h1>
      <p className="text-[14px] text-muted leading-relaxed mt-3 mb-6">Your secure email link is ready. Choose the account details only you will know, then sign in.</p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-[12px] font-semibold text-muted mb-1">Full name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            maxLength={160}
            required
            className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-brand"
            placeholder="Maya Chen"
          />
        </label>
        <label className="block">
          <span className="block text-[12px] font-semibold text-muted mb-1">Create password</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
            required
            className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-brand"
            placeholder="At least 12 characters"
          />
          <span className="block text-[11.5px] text-muted mt-1">12–256 characters, with a letter and a number.</span>
        </label>
        <label className="block">
          <span className="block text-[12px] font-semibold text-muted mb-1">Confirm password</span>
          <input
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            type="password"
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
            required
            className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-brand"
            placeholder="Re-enter your password"
          />
        </label>
        {confirm && password !== confirm ? <p className="m-0 text-[12.5px] text-[#a32d2d]">Passwords don&apos;t match.</p> : null}
        <label className="flex items-start gap-2 text-[11.5px] leading-relaxed text-muted">
          <input type="checkbox" checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} required className="mt-0.5 h-4 w-4 accent-primary" />
          <span>I agree to the <Link href="/terms" target="_blank" className="text-primary">Terms of Service</Link> and acknowledge the <Link href="/privacy" target="_blank" className="text-primary">Privacy Policy</Link>.</span>
        </label>
        {error ? <p className="m-0 text-[12.5px] text-[#a32d2d]">{error}</p> : null}
        <button type="submit" disabled={!canSubmit} className={`w-full py-3 text-[14px] inline-flex items-center justify-center rounded-full ${canSubmit ? "btn-grad" : "bg-[#cfd6e0] text-white font-bold cursor-not-allowed"}`}>
          {submitting ? "Creating account…" : "Create account & sign in"}
        </button>
      </form>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="min-h-screen bg-page flex items-center justify-center px-5 py-10">
      <section className="w-full max-w-[420px] bg-white border border-line rounded-lg shadow-sm p-8">
        <div className="flex items-center gap-2.5 mb-7">
          <span className="w-9 h-9 rounded-[9px] bg-brand-grad text-white flex items-center justify-center"><IconDiamond size={20} /></span>
          <span className="text-[20px] text-head font-medium">Jewel<span className="font-extrabold">Hire</span></span>
        </div>
        <VerificationForm />
      </section>
    </main>
  );
}
