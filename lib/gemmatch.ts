// JewelCert pick-10 domain model + scoring helpers.
// NOTE: scoring/fit functions are reference stubs. In production the matching
// service supplies `mix`, `fitScore`, and `tier`; the UI just consumes them.

export type ProfileCode = "V" | "C" | "F" | "D";

export type Mix = Record<ProfileCode, number>; // shares, sum ~100

export interface Profile {
  code: ProfileCode;
  name: string;
  lane: string;
  color: string;
}

export const PROFILES: Record<ProfileCode, Profile> = {
  V: { code: "V", name: "Visionary", lane: "Strategy & ideas", color: "#4681F4" },
  C: { code: "C", name: "Connector", lane: "People & energy", color: "#7C6CF0" },
  F: { code: "F", name: "Foundation", lane: "Steady & precise", color: "#1f9e75" },
  D: { code: "D", name: "Determined", lane: "Drive & results", color: "#e2683c" },
};

export const PROFILE_ORDER: ProfileCode[] = ["V", "C", "F", "D"];

// 12 named types = one per ordered (primary -> secondary) pair.
export const TYPE_BY_PAIR: Record<ProfileCode, Record<string, string>> = {
  V: { F: "Architect", C: "Innovator", D: "Trailblazer" },
  C: { F: "Luxury Advisor", V: "Team Captain", D: "Motivator" },
  F: { V: "Operational Anchor", C: "Adaptable Specialist", D: "Master Craftsman" },
  D: { V: "Visionary Leader", C: "Sales Strategist", F: "Master Analyst" },
};

// The adjective -> trait map (the assessment ANSWER KEY) and score() live in
// lib/server/gemmatch-scoring — server only. This module is imported by client
// components (for PROFILES/types), so the key must not be here or it ships to
// the browser. The taker uses the text-only lib/gemmatch-adjectives.

export interface GemMatchResult {
  mix: Mix;
  primary: ProfileCode;
  secondary: ProfileCode;
  type: string;
  clarity: string;
}

export function clarityLabel(primaryPct: number, primaryName: string): string {
  if (primaryPct >= 50) return `Clear ${primaryName}`;
  if (primaryPct >= 40) return `Strong ${primaryName} lean`;
  if (primaryPct >= 30) return `${primaryName} blend`;
  return "Balanced / versatile";
}

export type FitTier = "Strong fit" | "Good fit" | "Stretch" | "Poor fit";

export function fitTier(score: number): FitTier {
  if (score >= 75) return "Strong fit";
  if (score >= 60) return "Good fit";
  if (score >= 45) return "Stretch";
  return "Poor fit";
}

// Job-aware fit: how much of the candidate's real mix falls in the traits the
// job wants (idealGemMatchMix). No ideal set -> fall back to the primary's share.
export function fitFor(mix: Mix, idealMix: ProfileCode[] | null | undefined): { fitScore: number; tier: FitTier } {
  let raw: number;
  if (idealMix && idealMix.length) {
    raw = idealMix.reduce((sum, p) => sum + (mix[p] || 0), 0);
  } else {
    raw = Math.max(mix.V, mix.C, mix.F, mix.D);
  }
  const fitScore = Math.max(0, Math.min(100, Math.round(raw)));
  return { fitScore, tier: fitTier(fitScore) };
}

export interface FitBreakdown {
  fitScore: number;
  tier: FitTier;
  roleFit: number;
  teamFit: number;
  reasons: string[];
}
