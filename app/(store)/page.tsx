"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/common";
import { Radar } from "@/components/ui";
import { TEAM_MIX, FLOOR_TYPE } from "@/lib/data";
import { PROFILES } from "@/lib/gemmatch";
import { floorRead, DASH_KPIS, CAREERS, LOCATION_FLOORS, ACTIVITY, DashKpi, FloorRead } from "@/lib/dashboard";
import {
  IconDiamond,
  IconLink,
  IconCopy,
  IconQrcode,
  IconChevronRight,
  IconUserPlus,
  IconCalendar,
} from "@/components/icons";

const ACT_ICON = {
  apply: <IconUserPlus size={16} />,
  gemmatch: <IconDiamond size={16} />,
  interview: <IconCalendar size={16} />,
};

const STORE_ID = "store-sissys-little-rock";

const fallbackDashboard = {
  floor: floorRead(TEAM_MIX, FLOOR_TYPE, 9, 11),
  kpis: DASH_KPIS,
  careers: CAREERS,
  locations: LOCATION_FLOORS,
  activity: ACTIVITY,
};

function dashboardKpis(raw: {
  activeJobs?: number;
  applicants?: number;
  hired?: number;
  avgFit?: number;
  gemmatchCompletion?: number;
}): DashKpi[] {
  return [
    { key: "jobs", label: "Active job posts", value: String(raw.activeJobs ?? 0), sub: "Open for candidates", href: "/jobs" },
    { key: "applicants", label: "Applicants", value: String(raw.applicants ?? 0), sub: "Store-private pipeline", href: "/applicants" },
    { key: "hired", label: "Hired", value: String(raw.hired ?? 0), sub: "Local handoffs", href: "/pipeline" },
    { key: "fit", label: "Avg fit", value: String(raw.avgFit ?? 0), sub: "across results", href: "/gemmatch" },
    { key: "gemmatch", label: "GemMatch done", value: `${raw.gemmatchCompletion ?? 0}%`, sub: "completion", href: "/gemmatch" },
  ];
}

export default function Dashboard() {
  const router = useRouter();
  const [routeChecked, setRouteChecked] = useState(false);
  const [dashboard, setDashboard] = useState(fallbackDashboard);
  const floor = dashboard.floor;
  const untested = floor.total - floor.tested;
  const careers = dashboard.careers;
  const locations = dashboard.locations;
  const activity = dashboard.activity;

  // sparkline path (careers trend), y inverted
  const t = careers.trend;
  const max = Math.max(...t);
  const pts = t
    .map((v, i) => `${(i / (t.length - 1)) * 240},${36 - (v / max) * 30}`)
    .join(" ");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((session) => {
        if (cancelled) return;
        if (session.role === "admin") {
          router.replace("/admin");
          return;
        }
        if (session.role === "associate") {
          router.replace("/portal");
          return;
        }
        setRouteChecked(true);
      })
      .catch(() => {
        if (!cancelled) setRouteChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stores/${STORE_ID}/dashboard`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: {
        floor: FloorRead;
        kpis: Parameters<typeof dashboardKpis>[0];
        careers: typeof CAREERS;
        locations: typeof LOCATION_FLOORS;
        activity: typeof ACTIVITY;
      }) => {
        if (!cancelled) {
          setDashboard({
            floor: data.floor,
            kpis: dashboardKpis(data.kpis),
            careers: data.careers,
            locations: data.locations,
            activity: data.activity,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setDashboard(fallbackDashboard);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!routeChecked) {
    return null;
  }

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Where your floor stands today, and what's coming through the door."
        action={
          <select className="border border-line rounded-md bg-panel text-[13px] text-body px-3 py-2 outline-none focus:border-primary">
            <option>All locations (3)</option>
            {locations.map((l) => <option key={l.id}>{l.name}</option>)}
          </select>
        }
      />

      {/* HERO — where the floor is now (→ Team map) */}
      <Link href="/team-map" className="block no-underline group mb-[18px]">
        <div className="bg-panel border border-line rounded-lg px-5 py-[18px] group-hover:border-accent transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] text-muted">Where your floor is now</div>
              <div className="text-2xl font-semibold text-head mt-0.5">
                A <span className="text-primary">{floor.archetype}</span> floor
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted bg-[#f1f4f9] px-2.5 py-1 rounded-md whitespace-nowrap">
              <IconDiamond size={13} /> {floor.tested} of {floor.total} tested · {Math.round((floor.tested / floor.total) * 100)}%
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5 mt-3 items-center">
            <div>
              <p
                className="text-[13px] leading-relaxed text-head m-0 mb-3"
                dangerouslySetInnerHTML={{ __html: floor.summaryHtml }}
              />
              <div className="flex flex-col gap-1.5">
                {floor.bars.map((b) => (
                  <div key={b.code} className="flex items-center gap-2.5">
                    <span className="w-[68px] text-[12px]" style={{ color: b.color }}>{b.name}</span>
                    <span className="flex-1 h-[7px] bg-[#eef1f7] rounded-[4px] overflow-hidden">
                      <span className="block h-full" style={{ width: `${b.pct}%`, background: b.color }} />
                    </span>
                    <span className="w-[52px] text-right text-[11px] text-muted">{b.pct}% · {b.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="max-w-[220px] mx-auto w-full">
              <Radar mix={TEAM_MIX} />
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-line flex gap-1.5 flex-wrap">
            <span className="text-[11px] bg-[#e1f5ee] text-[#0f6e56] px-2 py-1 rounded-md">Strength: {floor.strength}</span>
            <span className="text-[11px] bg-[#fdf0e2] text-[#9a5a12] px-2 py-1 rounded-md">Watch: {floor.watch}</span>
            {untested > 0 && (
              <span className="text-[11px] bg-[#e8f1ff] text-primary px-2 py-1 rounded-md">{untested} associate{untested === 1 ? "" : "s"} not yet tested</span>
            )}
          </div>
        </div>
      </Link>

      {/* KPI strip — each tile → its detail page */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-[18px]">
        {dashboard.kpis.map((x) => (
          <Link key={x.key} href={x.href} className="no-underline group">
            <div className="bg-panel border border-line rounded px-4 py-[14px] h-full group-hover:border-accent transition-colors">
              <div className="text-[12px] text-muted font-medium">{x.label}</div>
              <div className="text-2xl font-semibold text-head mt-1 leading-none">{x.value}</div>
              {x.sub && <div className="text-[11.5px] text-muted mt-1.5">{x.sub}</div>}
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
        {/* By location → Team */}
        <Link href="/team" className="block no-underline group">
          <div className="bg-panel border border-line rounded-lg p-4 h-full group-hover:border-accent transition-colors">
            <div className="text-[13px] font-semibold text-head mb-2.5">Floor by location</div>
            <div className="flex flex-col gap-2.5">
              {locations.map((l, i) => (
                <div key={l.id} className="flex justify-between items-center text-[12.5px]">
                  <span className="text-body">{l.name} <span className="text-muted">· {l.count}</span></span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-md ${i === 0 ? "bg-[#e8f1ff] text-primary" : "bg-[#f1f4f9] text-muted"}`}>{l.archetype}</span>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <span className="text-[11px] bg-[#e8f1ff] text-primary px-2 py-1 rounded-md">Hire next: {PROFILES[floor.hireNext].name}-type</span>
            </div>
          </div>
        </Link>

        {/* Careers page → Public page */}
        <Link href="/public-page" className="block no-underline group">
          <div className="bg-panel border border-line rounded-lg p-4 h-full group-hover:border-accent transition-colors">
            <div className="flex justify-between items-center mb-2">
              <div className="text-[13px] font-semibold text-head">Careers page</div>
              <span className="text-[11px] bg-[#e1f5ee] text-[#0f6e56] px-2 py-1 rounded-md">{careers.status}</span>
            </div>
            <div className="flex gap-4 mb-2.5">
              <Stat label="Views (30d)" value={careers.views30d.toLocaleString()} />
              <Stat label="Visitors" value={careers.visitors.toLocaleString()} />
              <Stat label="Apply rate" value={`${careers.applyRate}%`} />
            </div>
            <svg viewBox="0 0 240 40" className="w-full h-[34px] block mb-2.5" preserveAspectRatio="none">
              <polyline points={pts} fill="none" stroke="#2F7DFF" strokeWidth={2} />
            </svg>
            <div className="flex items-center gap-1.5 bg-[#f1f4f9] rounded-md px-2 py-1.5">
              <IconLink size={15} className="text-muted" />
              <span className="flex-1 text-[12px] font-mono text-body truncate">{careers.url}</span>
              <span className="inline-flex items-center gap-1 text-[11px] border border-line rounded px-2 py-1 text-body bg-panel"><IconCopy size={13} /> Copy</span>
              <span className="inline-flex items-center text-[11px] border border-line rounded px-1.5 py-1 text-body bg-panel"><IconQrcode size={13} /></span>
            </div>
          </div>
        </Link>
      </div>

      {/* Activity feed — each row → its record */}
      <div className="bg-panel border border-line rounded-lg p-4 mt-[18px]">
        <div className="text-[13px] font-semibold text-head mb-2">Recent activity</div>
        <div className="flex flex-col">
          {activity.map((a) => (
            <Link key={a.text} href={a.href} className="flex items-center gap-2.5 text-[12.5px] text-body no-underline py-1.5 px-1 -mx-1 rounded hover:bg-rowhover">
              <span className="text-primary">{ACT_ICON[a.icon]}</span>
              <span>{a.text}</span>
              <span className="ml-auto text-[11px] text-muted">{a.when}</span>
              <IconChevronRight size={15} className="text-muted" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className="text-[18px] font-semibold text-head">{value}</div>
    </div>
  );
}
