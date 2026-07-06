"use client";

import { useState } from "react";
import { IconDiamond } from "@/components/icons";

export default function StoreSignupPage() {
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = companyName.trim().length >= 2 && email.trim().length > 3 && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/auth/store-signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyName: companyName.trim(), ownerName: ownerName.trim(), email: email.trim(), promoCode: promoCode.trim() }),
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
        <p className="text-[14px] text-muted leading-relaxed mt-3 mb-6">Set up hiring, assessments, and JewelCert for your store. You&apos;ll complete payment on the next step, then set your password.</p>
        <form onSubmit={submit} className="space-y-3">
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
          <label className="block">
            <span className="block text-[12px] font-semibold text-muted mb-1">Promo code <span className="font-normal text-muted">(optional)</span></span>
            <input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-brand" placeholder="Apply at checkout" />
            <span className="block text-[11.5px] text-muted mt-1">You can also enter or change a promo code on the Stripe checkout page.</span>
          </label>
          {error ? <p className="m-0 text-[12.5px] text-[#a32d2d]">{error}</p> : null}
          <button type="submit" disabled={!canSubmit} className={`w-full py-3 text-[14px] inline-flex items-center justify-center rounded-full ${canSubmit ? "btn-grad" : "bg-[#cfd6e0] text-white font-bold cursor-not-allowed"}`}>
            {submitting ? "Starting checkout…" : "Continue to payment"}
          </button>
          <div className="text-center text-[12.5px] text-muted">Already have an account? <a href="/login" className="text-primary no-underline hover:underline">Sign in</a></div>
        </form>
      </section>
    </main>
  );
}
