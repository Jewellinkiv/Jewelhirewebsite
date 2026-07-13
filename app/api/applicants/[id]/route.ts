import { NextResponse } from "next/server";
import { activeStoreId, requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { requireLocationInScope } from "@/lib/server/location-scope";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresStoreApplicantDetail } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const access = await requireLocationScopedStoreAccess(await activeStoreId(), "applicants.detail");
  const detail =
    getStorageRuntime() === "postgres"
      ? await getPostgresStoreApplicantDetail(
          params.id,
          access.storeId,
        )
      : await getApplicantStore().getStoreApplicantDetail(params.id);

  if (!detail) return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
  requireLocationInScope(detail.job?.location || detail.profile.location, access.locationIds, "applicants.detail");
  return NextResponse.json(detail);
});
