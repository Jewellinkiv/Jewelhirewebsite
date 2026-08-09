export type JobLocationScope = "all" | "selected";
export type ApplicantLocationPreferenceScope = "any" | "selected";

export type JobLocationOption = { id: string; name: string };

export type JobLocationTarget = {
  locationScope?: JobLocationScope;
  locationIds?: string[];
  locationId?: string | null;
  location?: string;
};

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function isJobLocationScope(value: unknown): value is JobLocationScope {
  return value === "all" || value === "selected";
}

export function isApplicantLocationPreferenceScope(value: unknown): value is ApplicantLocationPreferenceScope {
  return value === "any" || value === "selected";
}

export function targetLocationIds(target: JobLocationTarget, locations: JobLocationOption[]) {
  if (target.locationScope === "all") return locations.map((location) => location.id);
  const explicit = unique(target.locationIds || []);
  if (explicit.length) return explicit;
  return target.locationId ? [target.locationId] : [];
}

export function locationSummary(scope: JobLocationScope, locationIds: string[], locations: JobLocationOption[]) {
  if (scope === "all") return "All locations";
  const names = locationIds
    .map((id) => locations.find((location) => location.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return "Selected locations";
  if (names.length === 1) return names[0];
  if (names.length === 2) return names.join(" · ");
  return `${names.slice(0, 2).join(" · ")} + ${names.length - 2} more`;
}

export function normalizeJobLocationTargeting(
  input: { locationScope?: unknown; locationIds?: unknown; locationId?: unknown; location?: unknown },
  locations: JobLocationOption[],
): { locationScope: JobLocationScope; locationIds: string[]; location: string } | { error: string } {
  const locationScope: JobLocationScope = input.locationScope === "all" ? "all" : "selected";
  const requestedIds = Array.isArray(input.locationIds)
    ? unique(input.locationIds.filter((value): value is string => typeof value === "string"))
    : typeof input.locationId === "string" && input.locationId.trim() ? [input.locationId.trim()] : [];
  const validIds = new Set(locations.map((location) => location.id));

  if (locationScope === "all") {
    if (locations.length === 0) return { error: "Add at least one store location before making a role available everywhere." };
    return { locationScope, locationIds: locations.map((location) => location.id), location: locationSummary(locationScope, [], locations) };
  }

  const locationIds = requestedIds.filter((id) => validIds.has(id));
  if (locationIds.length === 0) return { error: "Choose at least one store location for this role." };
  if (locationIds.length !== requestedIds.length) return { error: "One or more selected store locations are unavailable." };
  return { locationScope, locationIds, location: locationSummary(locationScope, locationIds, locations) };
}

export function jobTargetsLocation(target: JobLocationTarget, locationId: string | null | undefined, locations: JobLocationOption[] = []) {
  if (!locationId) return true;
  return targetLocationIds(target, locations).includes(locationId);
}

export function jobIntersectsLocationScope(target: JobLocationTarget, allowedLocationIds?: string[]) {
  if (!allowedLocationIds) return true;
  const targetIds = targetLocationIds(target, []);
  if (target.locationScope === "all") return allowedLocationIds.length > 0;
  return targetIds.some((id) => allowedLocationIds.includes(id));
}

export function jobFitsLocationScope(target: JobLocationTarget, allowedLocationIds?: string[]) {
  if (!allowedLocationIds) return true;
  const targetIds = targetLocationIds(target, []);
  return target.locationScope !== "all" && targetIds.length > 0 && targetIds.every((id) => allowedLocationIds.includes(id));
}

export function applicationIntersectsLocationScope(
  application: { preferredLocationScope?: ApplicantLocationPreferenceScope; preferredLocationIds?: string[] },
  job: JobLocationTarget,
  allowedLocationIds?: string[],
) {
  if (!allowedLocationIds) return true;
  if (application.preferredLocationScope === "selected") {
    return (application.preferredLocationIds || []).some((id) => allowedLocationIds.includes(id));
  }
  // “Any participating store” and legacy applications without a recorded
  // preference remain visible to each manager whose location participates in
  // the role. A candidate who named other locations is not exposed to them.
  return jobIntersectsLocationScope(job, allowedLocationIds);
}
