"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { currentLegalConsentPayload } from "@/lib/legal";
import { isStrongPassword } from "@/lib/password-policy";

type Preview = "loading" | "invalid" | "existing" | "new";
type SettledPreview = {
  token: string;
  state: Exclude<Preview, "loading">;
  next: string;
  loginPath?: string;
  jewellinkRequired?: boolean;
};

function ClaimForm() {
  const inviteId = String(useParams().inviteId || "");
  const tokenInMemory = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<SettledPreview | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useLayoutEffect(() => {
    // URL fragments do not reach the server. Capture each initial or later
    // claim token only in component memory, then scrub the complete fragment
    // and any legacy query string before the browser paints or navigates.
    const captureAndScrubToken = () => {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      if (fragment.has("t")) {
        tokenInMemory.current = fragment.get("t") || "";
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
    if (!token) return;

    const controller = new AbortController();
    fetch("/api/auth/jewelcert-claim/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inviteId, token }),
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        setPreview({
          token,
          state: d.valid ? (d.existingAccount ? "existing" : "new") : "invalid",
          next: d.next || `/bundle/${inviteId}`,
          loginPath: d.loginPath,
          jewellinkRequired: d.jewellinkRequired === true,
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPreview({ token, state: "invalid", next: `/bundle/${inviteId}` });
      });
    return () => controller.abort();
  }, [inviteId, token]);

  const state: Preview = token === null
    ? "loading"
    : !token
      ? "invalid"
      : preview?.token === token
        ? preview.state
        : "loading";
  const next = preview?.token === token ? preview.next : `/bundle/${inviteId}`;
  const loginPath = preview?.token === token && preview.loginPath
    ? preview.loginPath
    : `/login?next=${encodeURIComponent(next)}`;
  const jewellinkRequired = preview?.token === token && preview.jewellinkRequired === true;

  const strong = isStrongPassword(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strong || !legalAccepted || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/auth/jewelcert-claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inviteId,
          token,
          password,
          name,
          ...currentLegalConsentPayload(),
        }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        setError(body?.error?.message || "We couldn't set that up. Please try again.");
        setSubmitting(false);
        return;
      }
      if (body?.existingAccount) {
        window.location.href = body.loginPath || `/login?next=${encodeURIComponent(body.next || next)}`;
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
          <div className="text-[15px] font-semibold text-head">{jewellinkRequired ? "Continue with JewelLink" : "You already have an account"}</div>
          <p className="mt-1.5 text-[13px] text-muted">{jewellinkRequired ? "Sign in through JewelLink to securely open this JewelCert." : "Sign in to open your JewelCert."}</p>
          <a href={loginPath} className="btn-grad inline-flex items-center gap-1.5 mt-4 px-4 py-2.5 text-[13px] no-underline">{jewellinkRequired ? "Continue to JewelLink sign in" : "Sign in to continue"}</a>
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
        <div className="flex items-start gap-2.5 rounded-md border border-line bg-white px-3 py-2.5">
          <input
            id="jewelcert-claim-legal-consent"
            checked={legalAccepted}
            onChange={(event) => setLegalAccepted(event.target.checked)}
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            required
          />
          <label htmlFor="jewelcert-claim-legal-consent" className="text-[12px] leading-5 text-body">
            I agree to the JewelHire <Link href="/privacy" target="_blank" className="font-semibold text-primary">Privacy Policy</Link> and <Link href="/terms" target="_blank" className="font-semibold text-primary">Terms of Service</Link>.
          </label>
        </div>
        {error ? <p className="m-0 text-[12.5px] text-[#a32d2d]">{error}</p> : null}
        <button type="submit" disabled={!strong || !legalAccepted || submitting} className={`w-full py-3 text-[14px] inline-flex items-center justify-center rounded-full ${strong && legalAccepted && !submitting ? "btn-grad" : "bg-[#cfd6e0] text-white font-bold cursor-not-allowed"}`}>
          {submitting ? "Setting up…" : "Start my JewelCert"}
        </button>
      </form>
    </div>
  );
}

export default function JewelCertClaimPage() {
  return <ClaimForm />;
}
