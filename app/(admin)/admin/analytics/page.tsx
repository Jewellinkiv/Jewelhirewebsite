"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import { COMPANIES, adminMetrics } from "@/lib/admin";

function Bar({ label, value, max, sub }: { label: string; value: number; max: number; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-2">
      <span className="w-[150px] text-[12.5px] text-body truncate">{label}</span>
      <span className="flex-1 h-2.5 bg-[#eef1f7] rounded-full overflow-hidden"><span className="block h-full bg-primary" style={{ width: `${max ? (value / max) * 100 : 0}%` }} /></span>
      <span className="w-[64px] text-right text-[11.5px] text-muted">{value}{sub}</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const fallbackMetrics = adminMetrics();
  const fallbackFunnel = [
    { key: "Assessments sent", value: fallbackMetrics.assessmentsSent },
    { key: "Completed", value: Math.round(fallbackMetrics.assessmentsSent * 0.78) },
    { key: "Interviewed", value: Math.round(fallbackMetrics.assessmentsSent * 0.31) },
    { key: "Hired", value: fallbackMetrics.hires },
  ];
  const fallbackFit = [{ key: "Strong fit", value: 38 }, { key: "Good fit", value: 41 }, { key: "Stretch", value: 15 }, { key: "Poor fit", value: 6 }];
  const fallbackAssessmentsByCompany = COMPANIES.map((company) => ({ companyId: company.id, name: company.name, value: company.assessmentsSent }));
  const fallbackAdoptionByPlan = (["Starter", "Growth", "Pro"] as const).map((tier) => ({
    tier,
    count: COMPANIES.filter((company) => company.plan === tier).length,
  }));
  const [funnel, setFunnel] = useState(fallbackFunnel);
  const [fit, setFit] = useState(fallbackFit);
  const [assessmentsByCompany, setAssessmentsByCompany] = useState(fallbackAssessmentsByCompany);
  const [adoptionByPlan, setAdoptionByPlan] = useState(fallbackAdoptionByPlan);
  const maxFunnel = funnel[0]?.value ?? 1;
  const maxSent = Math.max(...assessmentsByCompany.map((company) => company.value), 1);
  const planTotal = Math.max(adoptionByPlan.reduce((sum, plan) => sum + plan.count, 0), 1);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/analytics")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: {
        funnel: typeof fallbackFunnel;
        fitDistribution: typeof fallbackFit;
        assessmentsByCompany: typeof fallbackAssessmentsByCompany;
        adoptionByPlan: typeof fallbackAdoptionByPlan;
      }) => {
        if (!cancelled) {
          setFunnel(data.funnel);
          setFit(data.fitDistribution);
          setAssessmentsByCompany(data.assessmentsByCompany);
          setAdoptionByPlan(data.adoptionByPlan);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFunnel(fallbackFunnel);
          setFit(fallbackFit);
          setAssessmentsByCompany(fallbackAssessmentsByCompany);
          setAdoptionByPlan(fallbackAdoptionByPlan);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-[920px]">
      <h1 className="text-[21px] font-semibold text-head m-0">Analytics</h1>
      <p className="mt-1 mb-5 text-muted text-[13px]">Cross-company rollups. Aggregate only — no company's private data is exposed to another.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px] items-start">
        <Panel title="Hiring funnel (all companies)">
          <div className="p-4">{funnel.map((f) => <Bar key={f.key} label={f.key} value={f.value} max={maxFunnel} />)}</div>
        </Panel>

        <Panel title="JewelCert fit distribution">
          <div className="p-4">{fit.map((f) => <Bar key={f.key} label={f.key} value={f.value} max={100} sub="%" />)}</div>
        </Panel>

        <Panel title="Assessments sent by company">
          <div className="p-4">{assessmentsByCompany.map((c) => <Bar key={c.companyId} label={c.name} value={c.value} max={maxSent} />)}</div>
        </Panel>

        <Panel title="Adoption by plan">
          <div className="p-4">
            {adoptionByPlan.map((plan) => (
              <Bar key={plan.tier} label={plan.tier} value={plan.count} max={planTotal} />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
