import { NextResponse } from "next/server";
import { DEFAULT_STORE_ID } from "@/lib/applicant-lifecycle";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresApplicationDetail } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const url = new URL(request.url);
  const storeId = await requireStoreAccess(url.searchParams.get("storeId") || DEFAULT_STORE_ID, "applications.detail");
  const detail = await (
    getStorageRuntime() === "postgres"
      ? await getPostgresApplicationDetail({ applicationId: params.id, storeId })
      : getApplicantStore().getStoreApplicationDetail({ applicationId: params.id, storeId })
  );

  if (!detail) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
});
