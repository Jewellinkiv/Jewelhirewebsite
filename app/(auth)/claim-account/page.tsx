"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconDiamond } from "@/components/icons";
import { PASSWORD_MAX_LENGTH, isStrongPassword } from "@/lib/password-policy";

function ClaimForm() {
  const tokenInMemory = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "invalid" | "ready">("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useLayoutEffect(() => {
    // Capture the fragment bearer before paint, retain it only in component
    // memory, and scrub both fragment and any legacy query string immediately.
    // hashchange support lets a newer emailed link replace an old one in-place.
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

  useEffect(() => {
    if (token === null) return;
    if (!token) {
      setStatus("invalid");
      return;
    }
    setStatus("loading");
    const controller = new AbortController();
    let active = true;
    fetch("/api/auth/account-claim/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((body) => {
        if (!active) return;
        setStatus(body?.valid ? "ready" : "invalid");
      })
      .catch((error) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        setStatus("invalid");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [token]);

  const strong = isStrongPassword(password);
  const canSubmit = Boolean(token) && status === "ready" && strong && password === confirm && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/auth/account-claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        setError(body?.error?.message || "We couldn't set your password. Please try again.");
        setSubmitting(false);
        return;
      }
      window.location.href = body?.next || "/";
    } catch {
      setError("We couldn't reach the server. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <section className="w-full max-w-[420px] bg-white border border-line rounded-lg shadow-sm p-8">
      <div className="flex items-center gap-2.5 mb-7">
        <span className="w-9 h-9 rounded-[9px] bg-brand-grad text-white flex items-center justify-center"><IconDiamond size={20} /></span>
        <span className="text-[20px] text-head font-medium">Jewel<span className="font-extrabold">Hire</span></span>
      </div>

      {status === "loading" && <p className="text-[14px] text-muted m-0">Checking your link…</p>}

      {status === "invalid" && (
        <>
          <h1 className="text-[22px] leading-tight font-extrabold text-head m-0">This link isn&apos;t valid</h1>
          <p className="text-[14px] text-muted leading-relaxed mt-3 mb-5">It may have expired or already been used. You can reset your password to get back in.</p>
          <a href="/forgot-password" className="btn-grad w-full inline-flex items-center justify-center px-5 py-3 text-[14px] no-underline">Reset your password</a>
        </>
      )}

      {status === "ready" && (
        <>
          <h1 className="text-[24px] leading-tight font-extrabold text-head m-0">Set your password</h1>
          <p className="text-[14px] text-muted leading-relaxed mt-3 mb-6">Choose a password to finish setting up your account and sign in.</p>
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="block text-[12px] font-semibold text-muted mb-1">Password</span>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH} required className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-brand" placeholder="At least 12 characters" />
              <span className="block text-[11.5px] text-muted mt-1">12+ characters, with a letter and a number.</span>
            </label>
            <label className="block">
              <span className="block text-[12px] font-semibold text-muted mb-1">Confirm password</span>
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH} required className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-brand" placeholder="Re-enter your password" />
            </label>
            {confirm.length > 0 && password !== confirm ? <p className="m-0 text-[12.5px] text-[#a32d2d]">Passwords don&apos;t match.</p> : null}
            {error ? <p className="m-0 text-[12.5px] text-[#a32d2d]">{error}</p> : null}
            <button type="submit" disabled={!canSubmit} className={`w-full py-3 text-[14px] inline-flex items-center justify-center rounded-full ${canSubmit ? "btn-grad" : "bg-[#cfd6e0] text-white font-bold cursor-not-allowed"}`}>
              {submitting ? "Setting up…" : "Set password & sign in"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}

export default function ClaimAccountPage() {
  return (
    <main className="min-h-screen bg-page flex items-center justify-center px-5 py-10">
      <ClaimForm />
    </main>
  );
}
