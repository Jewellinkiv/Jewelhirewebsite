import { NextResponse } from "next/server";
import { ApplicationStage, DEFAULT_STORE_ID } from "@/lib/applicant-lifecycle";
import { requireStoreAccess } from "@/lib/server/access-control";
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
  const storeId = url.searchParams.get("storeId") || DEFAULT_STORE_ID;
  const query = url.searchParams.get("q") || "";
  const stage = url.searchParams.get("stage");
  const parsedStage = isApplicationStage(stage) ? stage : undefined;
  const result = await (
    getStorageRuntime() === "postgres"
      ? await listPostgresApplicationSummaries({
          storeId: await requireStoreAccess(storeId, "applications.list"),
          query,
          stage: parsedStage,
        })
      : getApplicantStore().listStoreApplicationSummaries({
          storeId,
          query,
          stage: parsedStage,
        })
  );

  return NextResponse.json({
    storeId,
    filters: { q: query, stage: parsedStage || null },
    total: result.total,
    count: result.items.length,
    items: result.items,
  });
});
