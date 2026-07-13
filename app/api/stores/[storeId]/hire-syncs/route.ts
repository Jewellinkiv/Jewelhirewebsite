import { NextResponse } from "next/server";
import { HireSyncStatus } from "@/lib/applicant-lifecycle";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { listPostgresHireSyncs } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { locationInScope } from "@/lib/server/location-scope";
import { listHireSyncs } from "@/lib/local-api-store";

const statuses = new Set<HireSyncStatus>(["pending", "synced", "failed", "cancelled"]);

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const access = await requireLocationScopedStoreAccess(params.storeId, "hire_syncs.list");
  const storeId = access.storeId;
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const normalizedStatus = status && statuses.has(status as HireSyncStatus) ? (status as HireSyncStatus) : undefined;
  if (getStorageRuntime() === "postgres") {
    const candidates = await listPostgresHireSyncs({ storeId, status: normalizedStatus });
    const items = candidates.filter(({ detail }) => locationInScope(detail?.job?.location || detail?.profile?.location, access.locationIds));
    return NextResponse.json({ storeId, count: items.length, items });
  }

  const items = listHireSyncs(storeId, normalizedStatus)
    .filter(({ detail }) => locationInScope(detail?.job?.location || detail?.profile?.location, access.locationIds));
  return NextResponse.json({ storeId, count: items.length, items });
});
