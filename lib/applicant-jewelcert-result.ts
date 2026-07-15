import { PROFILE_ORDER, PROFILES, TYPE_BY_PAIR, type Mix, type ProfileCode } from "@/lib/gemmatch";

export type ApplicantJewelCertResult = {
  primary: ProfileCode;
  secondary: ProfileCode;
  type: string;
  mix: Mix;
  completedAt: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isProfileCode(value: unknown): value is ProfileCode {
  return typeof value === "string" && PROFILE_ORDER.includes(value as ProfileCode);
}

function validMix(value: unknown): Mix | undefined {
  if (!isObject(value)) return undefined;
  const mix = Object.fromEntries(PROFILE_ORDER.map((code) => [code, value[code]])) as Record<ProfileCode, unknown>;
  if (PROFILE_ORDER.some((code) => typeof mix[code] !== "number" || !Number.isFinite(mix[code]) || mix[code] < 0 || mix[code] > 100)) {
    return undefined;
  }
  const total = PROFILE_ORDER.reduce((sum, code) => sum + (mix[code] as number), 0);
  if (total < 99 || total > 101) return undefined;
  return mix as Mix;
}

export function latestCompletedJewelCertResult(payload: unknown): ApplicantJewelCertResult | null {
  if (!isObject(payload) || !Array.isArray(payload.items)) return null;
  const completedResults: Array<ApplicantJewelCertResult & { completedAtMs: number }> = [];
  for (const item of payload.items) {
    if (!isObject(item) || item.kind !== "GemMatch" || item.status !== "completed") continue;
    if (!isProfileCode(item.resultProfileCode)) continue;
    if (typeof item.completedAt !== "string") continue;
    const completedAtMs = Date.parse(item.completedAt);
    if (!Number.isFinite(completedAtMs)) continue;
    const mix = validMix(item.resultMix);
    if (!mix) continue;
    const ranked = [...PROFILE_ORDER].sort((a, b) => mix[b] - mix[a]);
    const primary = ranked[0];
    const secondary = ranked[1];
    if (primary !== item.resultProfileCode || !secondary) continue;
    completedResults.push({
      primary,
      secondary,
      type: TYPE_BY_PAIR[primary][secondary] || PROFILES[primary].name,
      mix,
      completedAt: item.completedAt,
      completedAtMs,
    });
  }
  const latest = completedResults.sort((a, b) => b.completedAtMs - a.completedAtMs)[0];
  if (!latest) return null;
  return {
    primary: latest.primary,
    secondary: latest.secondary,
    type: latest.type,
    mix: latest.mix,
    completedAt: latest.completedAt,
  };
}
