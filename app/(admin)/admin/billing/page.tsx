"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import { COMPANIES, INVOICES, Invoice, PLANS, PLAN_STYLE, Plan, PlanTier } from "@/lib/admin";
import { IconProgress, IconCheck } from "@/components/icons";

const INV_STYLE: Record<string, string> = {
  Paid: "bg-[#e1f5ee] text-[#0f6e56]",
  Due: "bg-[#fff4e2] text-[#9a6a12]",
  "Past due": "bg-[#fcebeb] text-[#a32d2d]",
};

export default function BillingPage() {
  const fallbackMrr = COMPANIES.reduce((n, c) => n + (c.plan === "Pro" ? 349 : c.plan === "Growth" ? 149 : 49) * (c.status === "Active" ? 1 : 0), 0);
  const fallbackByPlan = (["Starter", "Growth", "Pro"] as PlanTier[]).map((tier) => ({ tier, count: COMPANIES.filter((c) => c.plan === tier).length }));
  const [mrr, setMrr] = useState(fallbackMrr);
  const [byPlan, setByPlan] = useState(fallbackByPlan);
  const [plans, setPlans] = useState<Plan[]>(PLANS);
  const [invoices, setInvoices] = useState<Invoice[]>(INVOICES);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/billing")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { mrr: number; byPlan: typeof fallbackByPlan; plans: Plan[]; invoices: Invoice[] }) => {
        if (!cancelled) {
          setMrr(data.mrr);
          setByPlan(data.byPlan);
          setPlans(data.plans);
          setInvoices(data.invoices);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMrr(fallbackMrr);
          setByPlan(fallbackByPlan);
          setPlans(PLANS);
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
        <div className="bg-panel border border-line rounded px-4 py-[15px]"><div className="text-xs text-muted font-medium">MRR (active)</div><div className="text-2xl font-semibold text-head mt-1.5 leading-none">${mrr.toLocaleString()}</div></div>
        {byPlan.map((p) => (
          <div key={p.tier} className="bg-panel border border-line rounded px-4 py-[15px]"><div className="text-xs text-muted font-medium">{p.tier} plan</div><div className="text-2xl font-semibold text-head mt-1.5 leading-none">{p.count}</div><div className="text-xs mt-1.5 text-muted">companies</div></div>
        ))}
      </div>

      <Panel title="Plans" icon={<IconProgress size={16} />} className="mb-[18px]">
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {plans.map((p) => (
            <div key={p.tier} className="rounded-md border border-line p-4">
              <div className="flex items-center justify-between"><span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full ${PLAN_STYLE[p.tier]}`}>{p.tier}</span><span className="text-[15px] font-semibold text-head">{p.price}</span></div>
              <div className="text-[12px] text-muted mt-1">{p.seats}</div>
              <ul className="mt-2.5 space-y-1.5 m-0 p-0 list-none">
                {p.features.map((f) => <li key={f} className="flex items-center gap-1.5 text-[12.5px] text-body"><IconCheck size={13} className="text-[#0f6e56]" /> {f}</li>)}
              </ul>
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
