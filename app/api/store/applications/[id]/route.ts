import { NextResponse } from "next/server";
import { DEFAULT_STORE_ID } from "@/lib/applicant-lifecycle";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { requireLocationInScope } from "@/lib/server/location-scope";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresApplicationDetail } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const url = new URL(request.url);
  const access = await requireLocationScopedStoreAccess(url.searchParams.get("storeId") || DEFAULT_STORE_ID, "applications.detail");
  const storeId = access.storeId;
  const detail = await (
    getStorageRuntime() === "postgres"
      ? await getPostgresApplicationDetail({ applicationId: params.id, storeId })
      : getApplicantStore().getStoreApplicationDetail({ applicationId: params.id, storeId })
  );

  if (!detail) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  requireLocationInScope(detail.job?.location || detail.profile?.location, access.locationIds, "applications.detail");

  return NextResponse.json(detail);
});
