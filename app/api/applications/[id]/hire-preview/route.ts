import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresApplicationStoreId, getPostgresHirePreview } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const url = new URL(request.url);
  if (getStorageRuntime() === "postgres") {
    const storeId = await getPostgresApplicationStoreId(params.id);
    if (!storeId) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    await requireStoreAccess(storeId, "hire.preview");
    const preview = await getPostgresHirePreview({
      applicationId: params.id,
      storeId,
      role: url.searchParams.get("role") || undefined,
      locationId: url.searchParams.get("locationId"),
    });
    if (!preview) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    return NextResponse.json(preview);
  }

  const preview = getApplicantStore().getHirePreview({
    applicationId: params.id,
    role: url.searchParams.get("role") || undefined,
    locationId: url.searchParams.get("locationId") || undefined,
  });

  if (!preview) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  return NextResponse.json(preview);
});
