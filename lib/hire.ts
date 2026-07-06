// Hire → JewelLink (Phase 1 — store-scoped). Helpers for the hire confirm step:
// the target store and a floor-recompute that blends the current team mix with a
// new hire's JewelCert mix. Reference math; production gets this from the service.

import { Mix, PROFILE_ORDER, ProfileCode } from "./gemmatch";
import { TEAM } from "./data";

export const HIRE_STORE = {
  name: "Sissy's Log Cabin",
  location: "Little Rock, Arkansas",
  // Canonical location slug (matches lib/team-locations.ts LOCATIONS[].id). The
  // `location` field above is the human-readable label for display; the hire POST
  // must send this slug as `locationId` so the new team member groups/filters under
  // Little Rock on the roster + team-composition views instead of a bogus string id.
  locationId: "little-rock",
  product: "JewelLink",
};

export const TEAM_SIZE = TEAM.length;

// Weighted blend of the current floor (teamSize members) with one new hire's mix,
// re-normalized to sum to exactly 100 (rounding drift applied to the largest share).
export function recomputeFloor(current: Mix, incoming: Mix, teamSize = TEAM_SIZE): Mix {
  const blended = PROFILE_ORDER.map((p) => ({
    p,
    v: (current[p] * teamSize + incoming[p]) / (teamSize + 1),
  }));
  const total = blended.reduce((s, x) => s + x.v, 0) || 1;
  const rounded = blended
    .map((x) => ({ p: x.p, v: Math.round((100 * x.v) / total) }))
    .sort((a, b) => b.v - a.v);
  let drift = 100 - rounded.reduce((s, x) => s + x.v, 0);
  let i = 0;
  while (drift !== 0 && rounded.length) {
    rounded[i % rounded.length].v += drift > 0 ? 1 : -1;
    drift += drift > 0 ? -1 : 1;
    i++;
  }
  return Object.fromEntries(rounded.map((x) => [x.p, x.v])) as Mix;
}

// Per-axis change (after − before), for the recompute preview.
export function mixDelta(before: Mix, after: Mix): Record<ProfileCode, number> {
  return Object.fromEntries(
    PROFILE_ORDER.map((p) => [p, after[p] - before[p]])
  ) as Record<ProfileCode, number>;
}
