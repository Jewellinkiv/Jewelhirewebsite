import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { listPostgresStoreApplicants } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const url = new URL(request.url);
  const storeId = await requireStoreAccess(params.storeId, "applicants.list");
  const filters = {
    q: url.searchParams.get("q") || "",
    scope: url.searchParams.get("scope") || "All",
    role: url.searchParams.get("role") || "All",
  };
  const items = await (
    getStorageRuntime() === "postgres"
      ? await listPostgresStoreApplicants({ storeId, ...filters })
      : getApplicantStore().listStoreApplicants({ storeId, ...filters })
  );

  return NextResponse.json({
    storeId,
    count: items.length,
    items,
  });
});
