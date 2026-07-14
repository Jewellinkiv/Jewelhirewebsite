import { AccessDeniedError } from "@/lib/server/access-errors";

export function normalizeLocationKey(value?: string | null) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/^location-/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function locationInScope(value: string | null | undefined, locationIds?: string[]) {
  if (!locationIds) return true;
  const key = normalizeLocationKey(value);
  return Boolean(key) && locationIds.some((locationId) => {
    const allowed = normalizeLocationKey(locationId);
    return key === allowed || key.includes(allowed) || allowed.includes(key);
  });
}

// Authorization checks that already hold a persisted location id must never
// use the label-friendly substring matching above. In particular, `north`
// must not authorize `north-mall` merely because one identifier prefixes the
// other.
export function locationIdInScope(value: string | null | undefined, locationIds?: string[]) {
  if (!locationIds) return true;
  const key = normalizeLocationKey(value);
  return Boolean(key) && locationIds.some((locationId) => normalizeLocationKey(locationId) === key);
}

export function requireLocationInScope(value: string | null | undefined, locationIds: string[] | undefined, operation: string) {
  if (!locationInScope(value, locationIds)) {
    throw new AccessDeniedError(`Location is not in scope for ${operation}`);
  }
}

export function requestedLocationInScope(requested: string | null | undefined, locationIds: string[] | undefined, operation: string) {
  if (!locationIds) return requested || undefined;
  if (requested) {
    requireLocationInScope(requested, locationIds, operation);
    return locationIds.find((locationId) => locationInScope(requested, [locationId])) || requested;
  }
  return locationIds.length === 1 ? locationIds[0] : undefined;
}
