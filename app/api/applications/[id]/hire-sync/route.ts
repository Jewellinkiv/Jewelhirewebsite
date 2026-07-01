import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresApplicationStoreId, getPostgresHireSyncForApplication } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (getStorageRuntime() === "postgres") {
    const storeId = await getPostgresApplicationStoreId(params.id);
    if (!storeId) return NextResponse.json({ error: "Hire sync not found" }, { status: 404 });
    await requireStoreAccess(storeId, "hire_sync.detail");
    const record = await getPostgresHireSyncForApplication(params.id);
    if (!record) return NextResponse.json({ error: "Hire sync not found" }, { status: 404 });
    return NextResponse.json(record);
  }

  const record = getApplicantStore().getHireSyncForApplication(params.id);
  if (!record) return NextResponse.json({ error: "Hire sync not found" }, { status: 404 });
  return NextResponse.json(record);
});
