import { NextResponse } from "next/server";
import { ApplicationStage } from "@/lib/applicant-lifecycle";
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

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const stage = url.searchParams.get("stage");
  const jewelcert = url.searchParams.get("jewelcert");
  const fit = url.searchParams.get("fit");
  const parsedStage = isApplicationStage(stage) ? stage : undefined;

  const storeId = await requireStoreAccess(params.storeId, "applications.list");

  const result = await (
    getStorageRuntime() === "postgres"
      ? await listPostgresApplicationSummaries({
          storeId,
          query,
          stage: parsedStage,
        })
      : getApplicantStore().listStoreApplicationSummaries({
          storeId,
          query,
          stage: parsedStage,
        })
  );
  const items = result.items
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
    total: result.total,
    count: items.length,
    items,
  });
});
