// Server-only JewelCert scoring.
//
// ADJECTIVES pairs each word with the trait it scores into — i.e. the assessment
// ANSWER KEY. It must never reach the browser: many CLIENT components import
// lib/gemmatch for PROFILES/types, and if the key lived there it would be bundled
// into those client chunks (it was — including the candidate-facing portal). So
// the key + scoring live here, server-side only. The taker renders the text-only
// list from lib/gemmatch-adjectives; picks are scored here on submit.
import {
  clarityLabel,
  GemMatchResult,
  Mix,
  PROFILE_ORDER,
  PROFILES,
  ProfileCode,
  TYPE_BY_PAIR,
} from "@/lib/gemmatch";

// 48 adjectives, 12 per profile (single-pass, pick 10). Keep the words in sync
// with lib/gemmatch-adjectives (the client-safe, text-only mirror the taker uses).
export const ADJECTIVES: { text: string; profile: ProfileCode }[] = [
  ...["Strategic","Analytical","Big-picture","Inventive","Curious","Logical","Insightful","Systematic","Innovative","Perceptive","Visionary","Problem-solving"].map((t) => ({ text: t, profile: "V" as const })),
  ...["Friendly","Outgoing","Warm","Persuasive","Charming","Expressive","Sociable","Enthusiastic","Engaging","Empathetic","Encouraging","Optimistic"].map((t) => ({ text: t, profile: "C" as const })),
  ...["Dependable","Patient","Organized","Careful","Consistent","Detailed","Reliable","Methodical","Loyal","Precise","Diligent","Helpful"].map((t) => ({ text: t, profile: "F" as const })),
  ...["Competitive","Ambitious","Bold","Confident","Driven","Persistent","Decisive","Assertive","Tenacious","Self-motivated","Goal-oriented","Closer"].map((t) => ({ text: t, profile: "D" as const })),
];

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
