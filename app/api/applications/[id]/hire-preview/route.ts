import { NextResponse } from "next/server";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { AccessDeniedError } from "@/lib/server/access-errors";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { canonicalLocationId, locationIdInScope } from "@/lib/server/location-scope";
import { getPostgresApplicationDetail, getPostgresApplicationStoreId, getPostgresHirePreview, listPostgresStoreLocations } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { listStoreLocations } from "@/lib/local-team-store";
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
    const role = detail?.job?.title || url.searchParams.get("role") || detail?.profile?.resumeHeadline || "Associate";
    const requestedLocation = detail?.job?.location || url.searchParams.get("locationId");
    const locationId = canonicalLocationId(await listPostgresStoreLocations(storeId), requestedLocation);
    if (!locationId) {
      return NextResponse.json({ error: "The hiring location is missing or no longer available." }, { status: 409 });
    }
    if (!locationIdInScope(locationId, access.locationIds)) {
      throw new AccessDeniedError("Location is not in scope for hire.preview.target");
    }
    const preview = await getPostgresHirePreview({
      applicationId: params.id,
      storeId,
      role,
      locationId,
    });
    if (!preview) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    return NextResponse.json(preview);
  }

  const detail = getApplicationDetail(params.id);
  if (!detail) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  const access = await requireLocationScopedStoreAccess(detail.application.storeId, "hire.preview");
  const role = detail.job?.title || url.searchParams.get("role") || detail.profile?.resumeHeadline || "Associate";
  const locationId = canonicalLocationId(
    listStoreLocations(detail.application.storeId),
    detail.job?.location || url.searchParams.get("locationId"),
  );
  if (!locationId) {
    return NextResponse.json({ error: "The hiring location is missing or no longer available." }, { status: 409 });
  }
  if (!locationIdInScope(locationId, access.locationIds)) {
    throw new AccessDeniedError("Location is not in scope for hire.preview.target");
  }
  const preview = getApplicantStore().getHirePreview({
    applicationId: params.id,
    role,
    locationId,
  });

  if (!preview) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  return NextResponse.json(preview);
});
