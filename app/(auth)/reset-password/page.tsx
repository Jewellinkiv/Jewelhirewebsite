"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { IconDiamond } from "@/components/icons";
import { PASSWORD_MAX_LENGTH, isStrongPassword } from "@/lib/password-policy";

function ResetForm() {
  const tokenInMemory = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useLayoutEffect(() => {
    // Fragments are excluded from HTTP requests and access logs. Retain the
    // one-time bearer only in component memory, then remove both the fragment
    // and any legacy query string before the first paint. Listening for
    // hashchange also makes a second emailed link work in the same open tab.
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
  const canSubmit = Boolean(token) && strong && password === confirm && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        setError(body?.error?.message || "We couldn't reset your password. Try again.");
        setSubmitting(false);
        return;
      }
      const body = await r.json();
      if (body?.next) {
        window.location.href = body.next;
        return;
      }
      const role = body?.role;
      // Auto-logged-in — go to the right home.
      window.location.href = role === "admin" ? "/admin" : role === "associate" ? "/portal" : "/dashboard";
    } catch {
      setError("We couldn't reach the server. Please try again.");
      setSubmitting(false);
    }
  };

  if (token === null) {
    return <p className="text-[14px] text-muted m-0">Loading secure reset…</p>;
  }

  if (!token) {
    return (
      <>
        <h1 className="text-[24px] leading-tight font-extrabold text-head m-0">Invalid reset link</h1>
        <p className="text-[14px] text-muted leading-relaxed mt-3 mb-6">This link is missing its token. Request a new password reset to continue.</p>
        <a href="/forgot-password" className="btn-grad w-full inline-flex items-center justify-center px-5 py-3 text-[14px] no-underline">Request a new link</a>
      </>
    );
  }

  return (
    <>
      <h1 className="text-[24px] leading-tight font-extrabold text-head m-0">Choose a new password</h1>
      <p className="text-[14px] text-muted leading-relaxed mt-3 mb-6">At least 12 characters, with a letter and a number.</p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-[12px] font-semibold text-muted mb-1">New password</span>
          <input autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH} className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-brand" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>
        <label className="block">
          <span className="block text-[12px] font-semibold text-muted mb-1">Confirm password</span>
          <input autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH} className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-brand" value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" required />
        </label>
        {confirm && password !== confirm ? <p className="m-0 text-[12.5px] text-[#a32d2d]">Passwords don&apos;t match.</p> : null}
        {error ? <p className="m-0 text-[12.5px] text-[#a32d2d]">{error}</p> : null}
        <button className={`w-full inline-flex items-center justify-center px-5 py-3 text-[14px] rounded-full ${canSubmit ? "btn-grad" : "bg-[#cfd6e0] text-white font-bold cursor-not-allowed"}`} disabled={!canSubmit} type="submit">
          {submitting ? "Saving…" : "Set new password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-page flex items-center justify-center px-5 py-10">
      <section className="w-full max-w-[420px] bg-white border border-line rounded-lg shadow-sm p-8">
        <div className="flex items-center gap-2.5 mb-7">
          <span className="w-9 h-9 rounded-[9px] bg-brand-grad text-white flex items-center justify-center"><IconDiamond size={20} /></span>
          <span className="text-[20px] text-head font-medium">Jewel<span className="font-extrabold">Hire</span></span>
        </div>
        <ResetForm />
      </section>
    </main>
  );
}
