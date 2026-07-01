import { NextResponse } from "next/server";
import { activeStoreId, requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresStoreApplicantDetail } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const detail =
    getStorageRuntime() === "postgres"
      ? await getPostgresStoreApplicantDetail(
          params.id,
          await requireStoreAccess(await activeStoreId(), "applicants.detail"),
        )
      : getApplicantStore().getStoreApplicantDetail(params.id);

  if (!detail) return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
  return NextResponse.json(detail);
});
