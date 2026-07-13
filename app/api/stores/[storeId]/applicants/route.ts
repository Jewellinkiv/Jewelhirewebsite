import { NextResponse } from "next/server";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { locationInScope } from "@/lib/server/location-scope";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { listPostgresStoreApplicants } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const url = new URL(request.url);
  const access = await requireLocationScopedStoreAccess(params.storeId, "applicants.list");
  const storeId = access.storeId;
  const filters = {
    q: url.searchParams.get("q") || "",
    scope: url.searchParams.get("scope") || "All",
    role: url.searchParams.get("role") || "All",
  };
  const unscopedItems = await (
    getStorageRuntime() === "postgres"
      ? await listPostgresStoreApplicants({ storeId, ...filters })
      : getApplicantStore().listStoreApplicants({ storeId, ...filters })
  );
  const items = unscopedItems.filter((item) => locationInScope(item.location, access.locationIds));

  return NextResponse.json({
    storeId,
    count: items.length,
    items,
  });
});
