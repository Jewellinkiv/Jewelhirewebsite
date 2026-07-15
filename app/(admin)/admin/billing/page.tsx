"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import { COMPANIES, INVOICES, Invoice, PlanTier } from "@/lib/admin";
import { IconProgress, IconCheck } from "@/components/icons";

const INV_STYLE: Record<string, string> = {
  Paid: "bg-[#e1f5ee] text-[#0f6e56]",
  Due: "bg-[#fff4e2] text-[#9a6a12]",
  "Past due": "bg-[#fcebeb] text-[#a32d2d]",
};

const STANDALONE_OFFERS = [
  { cadence: "Monthly", price: "$149/month", detail: "Flexible month-to-month organization access." },
  { cadence: "Annual", price: "$1,299/year", detail: "One organization subscription · save $489 per year." },
] as const;

// Mock companies do not carry provider-backed entitlements, so they must not
// be presented as revenue when the production billing API is unavailable.
const FALLBACK_MRR = 0;
const FALLBACK_BY_PLAN = (["Starter", "Growth", "Pro"] as PlanTier[]).map((tier) => ({
  tier,
  count: COMPANIES.filter((company) => company.plan === tier).length,
}));

export default function BillingPage() {
  const [mrr, setMrr] = useState(FALLBACK_MRR);
  const [byPlan, setByPlan] = useState(FALLBACK_BY_PLAN);
  const [invoices, setInvoices] = useState<Invoice[]>(INVOICES);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/billing")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { mrr: number; byPlan: typeof FALLBACK_BY_PLAN; invoices: Invoice[] }) => {
        if (!cancelled) {
          setMrr(data.mrr);
          setByPlan(data.byPlan);
          setInvoices(data.invoices);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMrr(FALLBACK_MRR);
          setByPlan(FALLBACK_BY_PLAN);
          setInvoices(INVOICES);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="text-[21px] font-semibold text-head m-0">Billing & plans</h1>
      <p className="mt-1 mb-5 text-muted text-[13px]">Subscriptions, seats, and invoices across companies.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-[18px]">
        <div className="bg-panel border border-line rounded px-4 py-[15px]"><div className="text-xs text-muted font-medium">Stripe MRR (active)</div><div className="text-2xl font-semibold text-head mt-1.5 leading-none">${mrr.toLocaleString()}</div></div>
        {byPlan.map((p) => (
          <div key={p.tier} className="bg-panel border border-line rounded px-4 py-[15px]"><div className="text-xs text-muted font-medium">{p.tier} plan</div><div className="text-2xl font-semibold text-head mt-1.5 leading-none">{p.count}</div><div className="text-xs mt-1.5 text-muted">companies</div></div>
        ))}
      </div>

      <Panel title="Standalone organization access" icon={<IconProgress size={16} />} className="mb-[18px]">
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {STANDALONE_OFFERS.map((offer) => (
            <div key={offer.cadence} className="rounded-md border border-line p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full bg-[#e8f1ff] text-primary">{offer.cadence}</span>
                <span className="text-[15px] font-semibold text-head">{offer.price}</span>
              </div>
              <div className="text-[12px] text-muted mt-2 flex items-center gap-1.5"><IconCheck size={13} className="text-[#0f6e56]" />{offer.detail}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Recent invoices">
        <div className="overflow-x-auto"><table className="w-full border-collapse">
          <thead><tr>{["Invoice", "Company", "Amount", "Date", "Status"].map((h) => <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>)}</tr></thead>
          <tbody>
            {invoices.map((iv) => (
              <tr key={iv.id} className="hover:bg-rowhover">
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] font-mono text-muted">{iv.id}</td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] font-medium text-head">{iv.company}</td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">{iv.amount}</td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] text-muted">{iv.date}</td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${INV_STYLE[iv.status]}`}>{iv.status}</span></td>
              </tr>
            ))}
            {invoices.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted text-[13px]">No invoices yet.</td></tr>}
          </tbody>
        </table></div>
      </Panel>
    </div>
  );
}
