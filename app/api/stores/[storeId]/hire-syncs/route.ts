import { NextResponse } from "next/server";
import { HireSyncStatus } from "@/lib/applicant-lifecycle";
import { requireStoreAccess } from "@/lib/server/access-control";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { listPostgresHireSyncs } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

const statuses = new Set<HireSyncStatus>(["pending", "synced", "failed", "cancelled"]);

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const normalizedStatus = status && statuses.has(status as HireSyncStatus) ? (status as HireSyncStatus) : undefined;
  if (getStorageRuntime() === "postgres") {
    await requireStoreAccess(params.storeId, "hire_syncs.list");
    return listPostgresHireSyncs({ storeId: params.storeId, status: normalizedStatus }).then((items) =>
      NextResponse.json({ storeId: params.storeId, count: items.length, items }),
    );
  }

  const items = await getApplicantStore().listHireSyncs({
    storeId: params.storeId,
    status: normalizedStatus,
  });
  return NextResponse.json({ storeId: params.storeId, count: items.length, items });
});
