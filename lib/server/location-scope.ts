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

export function canonicalLocationId(
  locations: Array<{ id: string; name: string }>,
  requested?: string | null,
) {
  const raw = requested?.trim().toLowerCase() || "";
  if (!raw) return undefined;
  const key = normalizeLocationKey(requested);
  if (!key) return undefined;
  const exact = locations.filter((location) =>
    location.id.toLowerCase() === raw || normalizeLocationKey(location.id) === key || normalizeLocationKey(location.name) === key,
  );
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) return undefined;

  const compatible = locations.filter((location) => {
    const locationKey = normalizeLocationKey(location.name);
    return Boolean(locationKey) && (locationKey.includes(key) || key.includes(locationKey));
  });
  return compatible.length === 1 ? compatible[0].id : undefined;
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
