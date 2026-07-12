import { NextResponse } from "next/server";
import { ApplicationStage, DEFAULT_STORE_ID } from "@/lib/applicant-lifecycle";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { locationInScope } from "@/lib/server/location-scope";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { listPostgresApplicationSummaries } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export const dynamic = "force-dynamic";

function isApplicationStage(value: string | null): value is ApplicationStage {
  return (
    value === "applied" ||
    value === "jewelcert" ||
    value === "gemmatch" ||
    value === "interview" ||
    value === "offer" ||
    value === "hired" ||
    value === "rejected" ||
    value === "withdrawn"
  );
}

export const GET = withApiErrorHandling(async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedStoreId = url.searchParams.get("storeId") || DEFAULT_STORE_ID;
  // Enforce tenant scoping in BOTH runtimes (session-based, runtime-agnostic).
  // Previously the guard lived only inside the postgres branch, so the local
  // branch read summaries for any client-supplied ?storeId= with no access check.
  const access = await requireLocationScopedStoreAccess(requestedStoreId, "applications.list");
  const storeId = access.storeId;
  const query = url.searchParams.get("q") || "";
  const stage = url.searchParams.get("stage");
  const parsedStage = isApplicationStage(stage) ? stage : undefined;
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
  const result = await (
    getStorageRuntime() === "postgres"
      ? await listPostgresApplicationSummaries({
          storeId,
          query,
          stage: parsedStage,
          limit: access.locationIds ? 100 : limit,
          offset: access.locationIds ? 0 : offset,
        })
      : getApplicantStore().listStoreApplicationSummaries({
          storeId,
          query,
          stage: parsedStage,
        })
  );

  const scopedItems = result.items.filter((item) =>
    locationInScope(item.job?.location || item.applicant?.location, access.locationIds),
  );
  const items = access.locationIds ? scopedItems.slice(offset, offset + limit) : scopedItems;
  return NextResponse.json({
    storeId,
    filters: { q: query, stage: parsedStage || null, limit, offset },
    total: access.locationIds ? scopedItems.length : result.total,
    count: items.length,
    items,
  });
});
