"use client";

import { useState } from "react";
import Link from "next/link";
import { IconDiamond } from "@/components/icons";
import { currentLegalConsentPayload } from "@/lib/legal";

export default function StoreSignupPage() {
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("year");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = companyName.trim().length >= 2 && email.trim().length > 3 && legalAccepted && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/auth/store-signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyName: companyName.trim(), ownerName: ownerName.trim(), email: email.trim(), billingInterval, ...currentLegalConsentPayload() }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok || !body?.checkoutUrl) {
        setError(body?.error?.message || "We couldn't start checkout. Please try again.");
        setSubmitting(false);
        return;
      }
      // Hand off to Stripe. The account is provisioned only after payment confirms.
      window.location.href = body.checkoutUrl;
    } catch {
      setError("We couldn't reach the server. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-page flex items-center justify-center px-5 py-10">
      <section className="w-full max-w-[440px] bg-white border border-line rounded-lg shadow-sm p-8">
        <div className="flex items-center gap-2.5 mb-7">
          <span className="w-9 h-9 rounded-[9px] bg-brand-grad text-white flex items-center justify-center"><IconDiamond size={20} /></span>
          <span className="text-[20px] text-head font-medium">Jewel<span className="font-extrabold">Hire</span></span>
        </div>
        <h1 className="text-[24px] leading-tight font-extrabold text-head m-0">Start your store on JewelHire</h1>
        <p className="text-[14px] text-muted leading-relaxed mt-3 mb-6">Set up hiring, assessments, and JewelCert for your company. One subscription covers the organization. You&apos;ll complete payment on the next step, then set your password.</p>
        <form onSubmit={submit} className="space-y-3">
          <fieldset>
            <legend className="block text-[12px] font-semibold text-muted mb-2">Billing</legend>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={billingInterval === "month"}
                onClick={() => setBillingInterval("month")}
                className={`rounded-md border p-3 text-left ${billingInterval === "month" ? "border-primary bg-[#eef4ff]" : "border-line bg-white"}`}
              >
                <span className="block text-[13px] font-semibold text-head">$149/month</span>
                <span className="block text-[11px] text-muted mt-1">Billed monthly</span>
              </button>
              <button
                type="button"
                aria-pressed={billingInterval === "year"}
                onClick={() => setBillingInterval("year")}
                className={`rounded-md border p-3 text-left ${billingInterval === "year" ? "border-primary bg-[#eef4ff]" : "border-line bg-white"}`}
              >
                <span className="block text-[13px] font-semibold text-head">$1,299/year</span>
                <span className="block text-[11px] text-[#0f6e56] mt-1">Save $489 annually</span>
              </button>
            </div>
          </fieldset>
          <label className="block">
            <span className="block text-[12px] font-semibold text-muted mb-1">Store / company name</span>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-brand" placeholder="Acme Fine Jewelry" />
          </label>
          <label className="block">
            <span className="block text-[12px] font-semibold text-muted mb-1">Your name</span>
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} autoComplete="name" className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-brand" placeholder="Jordan Rivera" />
          </label>
          <label className="block">
            <span className="block text-[12px] font-semibold text-muted mb-1">Work email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-brand" placeholder="you@store.com" />
          </label>
          <p className="m-0 text-[11.5px] text-muted">Have a promotion code? Enter it securely on the Stripe checkout page.</p>
          {error ? <p className="m-0 text-[12.5px] text-[#a32d2d]">{error}</p> : null}
          <label className="flex items-start gap-2 text-[11.5px] leading-relaxed text-muted">
            <input type="checkbox" checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} required className="mt-0.5 h-4 w-4 accent-primary" />
            <span>I agree to the <Link href="/terms" target="_blank" className="text-primary">Terms of Service</Link> and acknowledge the <Link href="/privacy" target="_blank" className="text-primary">Privacy Policy</Link>.</span>
          </label>
          <button type="submit" disabled={!canSubmit} className={`w-full py-3 text-[14px] inline-flex items-center justify-center rounded-full ${canSubmit ? "btn-grad" : "bg-[#cfd6e0] text-white font-bold cursor-not-allowed"}`}>
            {submitting ? "Starting checkout…" : "Continue to payment"}
          </button>
          <div className="text-center text-[12.5px] text-muted">Already have an account? <Link href="/login" className="text-primary no-underline hover:underline">Sign in</Link></div>
        </form>
      </section>
    </main>
  );
}
