// GemMatch domain model + scoring helpers.
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

// 48 adjectives, 12 per profile (single-pass, pick 10).
export const ADJECTIVES: { text: string; profile: ProfileCode }[] = [
  ...["Strategic","Analytical","Big-picture","Inventive","Curious","Logical","Insightful","Systematic","Innovative","Perceptive","Visionary","Problem-solving"].map((t) => ({ text: t, profile: "V" as const })),
  ...["Friendly","Outgoing","Warm","Persuasive","Charming","Expressive","Sociable","Enthusiastic","Engaging","Empathetic","Encouraging","Optimistic"].map((t) => ({ text: t, profile: "C" as const })),
  ...["Dependable","Patient","Organized","Careful","Consistent","Detailed","Reliable","Methodical","Loyal","Precise","Diligent","Helpful"].map((t) => ({ text: t, profile: "F" as const })),
  ...["Competitive","Ambitious","Bold","Confident","Driven","Persistent","Decisive","Assertive","Tenacious","Self-motivated","Goal-oriented","Closer"].map((t) => ({ text: t, profile: "D" as const })),
];

export interface GemMatchResult {
  mix: Mix;
  primary: ProfileCode;
  secondary: ProfileCode;
  type: string;
  clarity: string;
}

// Reference scoring: single capped pass. Counts adjective picks -> mix -> type.
export function score(pickedAdjectiveTexts: string[]): GemMatchResult {
  const raw: Mix = { V: 0, C: 0, F: 0, D: 0 };
  for (const text of pickedAdjectiveTexts) {
    const adj = ADJECTIVES.find((a) => a.text === text);
    if (adj) raw[adj.profile] += 1;
  }
  const total = pickedAdjectiveTexts.length || 1;
  const mix = Object.fromEntries(
    PROFILE_ORDER.map((p) => [p, Math.round((100 * raw[p]) / total)])
  ) as Mix;
  const ranked = [...PROFILE_ORDER].sort((a, b) => mix[b] - mix[a]);
  const primary = ranked[0];
  const secondary = ranked[1];
  return {
    mix,
    primary,
    secondary,
    type: TYPE_BY_PAIR[primary][secondary] ?? PROFILES[primary].name,
    clarity: clarityLabel(mix[primary], PROFILES[primary].name),
  };
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

export interface FitBreakdown {
  fitScore: number;
  tier: FitTier;
  roleFit: number;
  teamFit: number;
  reasons: string[];
}
