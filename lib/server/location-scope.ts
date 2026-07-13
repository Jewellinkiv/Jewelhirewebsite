import { AccessDeniedError } from "@/lib/server/access-control";

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
