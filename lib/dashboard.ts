// Dashboard data: a template-based "where the floor is now" read derived from
// JewelCert results, plus careers-page analytics and an activity feed. Mock data;
// the floor read is generated from the mix so it adapts as results change.

import { Mix, ProfileCode, PROFILES, PROFILE_ORDER } from "./gemmatch";

// per-profile phrasing for the generated floor read
const TRAIT: Record<ProfileCode, string> = {
  V: "vision-led and strategic",
  C: "warm and people-first",
  F: "steady and precise",
  D: "high-energy and results-driven",
};
const STRENGTH: Record<ProfileCode, string> = {
  V: "creative, big-picture selling",
  C: "relationship building",
  F: "accuracy and follow-through",
  D: "fast, confident closing",
};
const WATCH: Record<ProfileCode, string> = {
  V: "long-term strategy",
  C: "repeat-client nurture",
  F: "detail and follow-through",
  D: "closing urgency",
};

export interface FloorRead {
  archetype: string;
  summaryHtml: string; // dominant + light profiles, colored
  bars: { code: ProfileCode; name: string; pct: number; count: number; color: string }[];
  strength: string;
  watch: string;
  hireNext: ProfileCode;
  tested: number;
  total: number;
}

export function floorRead(mix: Mix, archetype: string, tested: number, total: number): FloorRead {
  const ranked = [...PROFILE_ORDER].sort((a, b) => mix[b] - mix[a]);
  const [d1, d2] = ranked; // dominant two
  const l1 = ranked[3]; // lowest
  const l2 = ranked[2]; // second-lowest
  const span = (c: ProfileCode) =>
    `<span style="color:${PROFILES[c].color};font-weight:500">${PROFILES[c].name}</span>`;
  const summaryHtml =
    `Your team skews ${span(d1)} and ${span(d2)} — ${TRAIT[d1]}, strong at ${STRENGTH[d1]}. ` +
    `It runs lighter on ${span(l2)} and ${span(l1)}.`;
  const bars = PROFILE_ORDER.map((code) => ({
    code,
    name: PROFILES[code].name,
    pct: mix[code],
    count: Math.round((mix[code] / 100) * tested),
    color: PROFILES[code].color,
  }));
  return {
    archetype,
    summaryHtml,
    bars,
    strength: STRENGTH[d1],
    watch: WATCH[l1],
    hireNext: l1,
    tested,
    total,
  };
}

export interface DashKpi {
  key: string;
  label: string;
  value: string;
  sub?: string;
  href: string;
}

export const DASH_KPIS: DashKpi[] = [
  { key: "jobs", label: "Active job posts", value: "3", sub: "Sales, Mgr, Bench", href: "/jobs" },
  { key: "applicants", label: "Applicants", value: "47", sub: "+4 this week", href: "/applicants" },
  { key: "hired", label: "Hired", value: "6", sub: "this quarter", href: "/pipeline" },
  { key: "fit", label: "Avg fit", value: "78", sub: "across results", href: "/jewelcert" },
  { key: "jewelcert", label: "JewelCert done", value: "81%", sub: "completion", href: "/jewelcert" },
];

export interface CareersAnalytics {
  slug: string;
  url: string;
  status: "Published" | "Draft" | "Paused";
  views30d: number;
  applyStarts: number;
  submissions: number;
  applyRate: number; // percent
  trend: number[]; // sparkline samples, recent last
}

export const CAREERS: CareersAnalytics = {
  slug: "sissys",
  url: "jewelhire.co/careers/sissys",
  status: "Published",
  views30d: 1284,
  applyStarts: 182,
  submissions: 25,
  applyRate: 14,
  trend: [32, 28, 30, 22, 24, 16, 18, 9, 6],
};

export interface LocationFloor {
  id: string;
  name: string;
  count: number;
  archetype: string;
}

export const LOCATION_FLOORS: LocationFloor[] = [
  { id: "little-rock", name: "Little Rock", count: 6, archetype: "Powerhouse" },
  { id: "memphis", name: "Memphis", count: 3, archetype: "Harmony" },
  { id: "jonesboro", name: "Jonesboro", count: 2, archetype: "Balanced" },
];

export interface ActivityItem {
  icon: "apply" | "gemmatch" | "interview";
  text: string;
  when: string;
  href: string;
}

export const ACTIVITY: ActivityItem[] = [
  { icon: "apply", text: "Maya Chen applied — Sales Associate, Little Rock", when: "2h", href: "/applicants/maya-chen" },
  { icon: "gemmatch", text: "Devon Ross completed JewelCert — fit 88 · Strong", when: "5h", href: "/applicants/devon-ross" },
  { icon: "interview", text: "Interview scheduled — Jess Wood, Thu 2pm", when: "1d", href: "/interviews" },
];
