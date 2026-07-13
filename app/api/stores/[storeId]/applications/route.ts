import { NextResponse } from "next/server";
import { ApplicationStage } from "@/lib/applicant-lifecycle";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { locationInScope } from "@/lib/server/location-scope";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { listPostgresApplicationSummaries } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { listApplications, summarizeApplication } from "@/lib/local-api-store";

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

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const stage = url.searchParams.get("stage");
  const jewelcert = url.searchParams.get("jewelcert");
  const fit = url.searchParams.get("fit");
  const parsedStage = isApplicationStage(stage) ? stage : undefined;

  const access = await requireLocationScopedStoreAccess(params.storeId, "applications.list");
  const storeId = access.storeId;

  const result = getStorageRuntime() === "postgres"
      ? await listPostgresApplicationSummaries({
          storeId,
          query,
          stage: parsedStage,
        })
      : (() => {
          const all = listApplications(storeId);
          const normalizedQuery = query.trim().toLowerCase();
          const items = all
            .filter((application) => !parsedStage || application.stage === parsedStage)
            .map(summarizeApplication)
            .filter((item) => !normalizedQuery || [item.applicant?.fullName, item.applicant?.email, item.job?.title]
              .some((value) => value?.toLowerCase().includes(normalizedQuery)));
          return { total: all.length, items };
        })();
  const items = result.items
    .filter((item) => locationInScope(item.job?.location || item.applicant?.location, access.locationIds))
    .filter((item) => !jewelcert || item.screening.jewelcertStatus === jewelcert)
    .filter((item) => !fit || item.screening.gemmatchFit === fit);

  return NextResponse.json({
    storeId,
    filters: {
      q: query,
      stage: parsedStage || null,
      jewelcert: jewelcert || null,
      fit: fit || null,
    },
    total: access.locationIds ? items.length : result.total,
    count: items.length,
    items,
  });
});
