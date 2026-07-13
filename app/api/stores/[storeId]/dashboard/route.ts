import { NextResponse } from "next/server";
import { CAREERS, ACTIVITY, LOCATION_FLOORS, floorRead } from "@/lib/dashboard";
import { TEAM, TEAM_MIX, FLOOR_TYPE } from "@/lib/data";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { getPostgresStoreDashboard } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { locationInScope, requestedLocationInScope } from "@/lib/server/location-scope";
import { listApplications, summarizeApplication } from "@/lib/local-api-store";

function normalizeLocationId(value?: string | null) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized || normalized === "all") return "";
  return normalized.replace(/^location-/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function locationMatches(value: string | undefined, locationId: string) {
  if (!locationId) return true;
  const normalized = normalizeLocationId(value);
  return normalized.includes(locationId);
}

function fitScore(fit?: string): number | undefined {
  if (fit === "Strong fit") return 88;
  if (fit === "Good fit") return 76;
  if (fit === "Watch fit") return 62;
  if (fit === "Poor fit") return 45;
  return undefined;
}

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const access = await requireLocationScopedStoreAccess(params.storeId, "dashboard.read");
  const storeId = access.storeId;
  const requestedLocation = normalizeLocationId(new URL(request.url).searchParams.get("locationId"));
  const locationId = normalizeLocationId(
    requestedLocationInScope(requestedLocation, access.locationIds, "dashboard.read") || access.locationIds?.[0],
  );
  if (getStorageRuntime() === "postgres") {
    const dashboard = await getPostgresStoreDashboard(storeId, locationId);
    return NextResponse.json({
      ...dashboard,
      locations: dashboard.locations.filter((location) => locationInScope(location.id || location.name, access.locationIds)),
      activity: access.locationIds ? [] : dashboard.activity,
    });
  }

  const summaries = listApplications(storeId).map(summarizeApplication);
  const filtered = summaries.filter((item) =>
    locationMatches(item.job?.location || item.applicant?.location, locationId),
  );
  const selectedLocation = LOCATION_FLOORS.find((location) => location.id === locationId);
  const completedGemMatches = filtered.filter((item) => item.screening.gemmatchStatus === "completed").length;
  const hired = filtered.filter((item) => item.application.stage === "hired").length;
  const fitScores = filtered.map((item) => fitScore(item.screening.gemmatchFit)).filter((score): score is number => score !== undefined);
  const activeJobs = new Set(filtered.map((item) => item.application.jobId)).size || (locationId ? 0 : 3);
  const tested = selectedLocation ? selectedLocation.count : TEAM.length;
  const total = selectedLocation ? selectedLocation.count : TEAM.length + 2;
  const floor = floorRead(TEAM_MIX, selectedLocation?.archetype || FLOOR_TYPE, tested, total);

  return NextResponse.json({
    storeId,
    selectedLocationId: locationId || null,
    floor,
    kpis: {
      activeJobs,
      applicants: filtered.length,
      hired,
      avgFit: fitScores.length ? Math.round(fitScores.reduce((sum, score) => sum + score, 0) / fitScores.length) : 0,
      gemmatchCompletion: filtered.length ? Math.round((completedGemMatches / filtered.length) * 100) : 0,
    },
    careers: CAREERS,
    locations: LOCATION_FLOORS.filter((location) => locationInScope(location.id || location.name, access.locationIds)),
    activity: access.locationIds ? [] : ACTIVITY,
  });
});
