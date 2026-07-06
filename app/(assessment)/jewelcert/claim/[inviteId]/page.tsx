"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { isStrongPassword } from "@/lib/password-policy";

type Preview = "loading" | "invalid" | "existing" | "new";

function ClaimForm() {
  const inviteId = String(useParams().inviteId || "");
  const token = useSearchParams().get("t") || "";
  const [state, setState] = useState<Preview>("loading");
  const [next, setNext] = useState(`/bundle/${inviteId}`);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/jewelcert-claim?inviteId=${encodeURIComponent(inviteId)}&t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.valid) return setState("invalid");
        if (d.next) setNext(d.next);
        setState(d.existingAccount ? "existing" : "new");
      })
      .catch(() => setState("invalid"));
  }, [inviteId, token]);

  const strong = isStrongPassword(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strong || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/auth/jewelcert-claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId, token, password, name }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        setError(body?.error?.message || "We couldn't set that up. Please try again.");
        setSubmitting(false);
        return;
      }
      if (body?.existingAccount) {
        window.location.href = `/login?next=${encodeURIComponent(body.next || next)}`;
        return;
      }
      window.location.href = body?.next || next;
    } catch {
      setError("We couldn't reach the server. Please try again.");
      setSubmitting(false);
    }
  };

  if (state === "loading") {
    return <div className="flex-1 flex items-center justify-center py-16 text-[13px] text-muted">Loading your JewelCert…</div>;
  }
  if (state === "invalid") {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="text-center max-w-[380px]">
          <div className="text-[15px] font-semibold text-head">This link isn&apos;t valid anymore</div>
          <p className="mt-1.5 text-[13px] text-muted">Your JewelCert link may have expired or already been used. Ask the store to resend it, or sign in if you already have an account.</p>
          <Link href="/login" className="btn-grad inline-flex items-center gap-1.5 mt-4 px-4 py-2.5 text-[13px] no-underline">Sign in</Link>
        </div>
      </div>
    );
  }
  if (state === "existing") {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="text-center max-w-[380px]">
          <div className="text-[15px] font-semibold text-head">You already have an account</div>
          <p className="mt-1.5 text-[13px] text-muted">Sign in to open your JewelCert.</p>
          <a href={`/login?next=${encodeURIComponent(next)}`} className="btn-grad inline-flex items-center gap-1.5 mt-4 px-4 py-2.5 text-[13px] no-underline">Sign in to continue</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-center py-10 max-w-[420px] mx-auto w-full">
      <div className="mb-1 text-[12px] font-medium text-primary uppercase tracking-wide">Start your JewelCert</div>
      <h1 className="m-0 text-[22px] font-semibold text-head leading-tight">Create a password to begin</h1>
      <p className="mt-2 text-[13.5px] text-body">You were invited to complete a JewelCert. Set a password to start — and to come back to your results and any next steps.</p>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
        <label className="block">
          <span className="block text-[12px] font-semibold text-muted mb-1">Your name <span className="font-normal">(optional)</span></span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-primary" placeholder="Maya Chen" />
        </label>
        <label className="block">
          <span className="block text-[12px] font-semibold text-muted mb-1">Create a password</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-primary" placeholder="At least 12 characters" required />
          <span className="block text-[11.5px] text-muted mt-1">12+ characters, with a letter and a number.</span>
        </label>
        {error ? <p className="m-0 text-[12.5px] text-[#a32d2d]">{error}</p> : null}
        <button type="submit" disabled={!strong || submitting} className={`w-full py-3 text-[14px] inline-flex items-center justify-center rounded-full ${strong && !submitting ? "btn-grad" : "bg-[#cfd6e0] text-white font-bold cursor-not-allowed"}`}>
          {submitting ? "Setting up…" : "Start my JewelCert"}
        </button>
      </form>
    </div>
  );
}

export default function JewelCertClaimPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center py-16 text-[13px] text-muted">Loading…</div>}>
      <ClaimForm />
    </Suspense>
  );
}
