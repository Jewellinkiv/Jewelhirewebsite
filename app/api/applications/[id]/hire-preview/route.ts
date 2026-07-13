import { NextResponse } from "next/server";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { requireLocationInScope } from "@/lib/server/location-scope";
import { getPostgresApplicationDetail, getPostgresApplicationStoreId, getPostgresHirePreview } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicationDetail } from "@/lib/local-api-store";

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const url = new URL(request.url);
  if (getStorageRuntime() === "postgres") {
    const storeId = await getPostgresApplicationStoreId(params.id);
    if (!storeId) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    const access = await requireLocationScopedStoreAccess(storeId, "hire.preview");
    const detail = await getPostgresApplicationDetail({ applicationId: params.id, storeId });
    requireLocationInScope(detail?.job?.location || detail?.profile?.location, access.locationIds, "hire.preview");
    requireLocationInScope(url.searchParams.get("locationId") || detail?.job?.location, access.locationIds, "hire.preview.target");
    const preview = await getPostgresHirePreview({
      applicationId: params.id,
      storeId,
      role: url.searchParams.get("role") || undefined,
      locationId: url.searchParams.get("locationId"),
    });
    if (!preview) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    return NextResponse.json(preview);
  }

  const detail = getApplicationDetail(params.id);
  if (!detail) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  const access = await requireLocationScopedStoreAccess(detail.application.storeId, "hire.preview");
  requireLocationInScope(detail.job?.location || detail.profile?.location, access.locationIds, "hire.preview");
  requireLocationInScope(url.searchParams.get("locationId") || detail.job?.location, access.locationIds, "hire.preview.target");
  const preview = getApplicantStore().getHirePreview({
    applicationId: params.id,
    role: url.searchParams.get("role") || undefined,
    locationId: url.searchParams.get("locationId") || undefined,
  });

  if (!preview) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  return NextResponse.json(preview);
});
