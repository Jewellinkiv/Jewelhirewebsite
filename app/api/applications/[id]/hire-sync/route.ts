import { NextResponse } from "next/server";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { requireLocationInScope } from "@/lib/server/location-scope";
import { getPostgresApplicationDetail, getPostgresApplicationStoreId, getPostgresHireSyncForApplication } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicationDetail } from "@/lib/local-api-store";
import { syncPostgresHireToJewelLink } from "@/lib/server/jewellink-integration";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (getStorageRuntime() === "postgres") {
    const storeId = await getPostgresApplicationStoreId(params.id);
    if (!storeId) return NextResponse.json({ error: "Hire sync not found" }, { status: 404 });
    const access = await requireLocationScopedStoreAccess(storeId, "hire_sync.detail");
    const detail = await getPostgresApplicationDetail({ applicationId: params.id, storeId });
    requireLocationInScope(detail?.job?.location || detail?.profile?.location, access.locationIds, "hire_sync.detail");
    const record = await getPostgresHireSyncForApplication(params.id);
    if (!record) return NextResponse.json({ error: "Hire sync not found" }, { status: 404 });
    return NextResponse.json(record);
  }

  const detail = getApplicationDetail(params.id);
  if (!detail) return NextResponse.json({ error: "Hire sync not found" }, { status: 404 });
  const access = await requireLocationScopedStoreAccess(detail.application.storeId, "hire_sync.detail");
  requireLocationInScope(detail.job?.location || detail.profile?.location, access.locationIds, "hire_sync.detail");
  const record = getApplicantStore().getHireSyncForApplication(params.id);
  if (!record) return NextResponse.json({ error: "Hire sync not found" }, { status: 404 });
  return NextResponse.json(record);
});

export const POST = withApiErrorHandling(async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (getStorageRuntime() !== "postgres") {
    return NextResponse.json({ error: "JewelLink synchronization requires the PostgreSQL runtime" }, { status: 501 });
  }
  const storeId = await getPostgresApplicationStoreId(params.id);
  if (!storeId) return NextResponse.json({ error: "Hire sync not found" }, { status: 404 });
  const access = await requireLocationScopedStoreAccess(storeId, "hire_sync.retry");
  const detail = await getPostgresApplicationDetail({ applicationId: params.id, storeId });
  requireLocationInScope(detail?.job?.location || detail?.profile?.location, access.locationIds, "hire_sync.retry");
  const record = await syncPostgresHireToJewelLink(params.id);
  if (!record) return NextResponse.json({ error: "Hire sync not found" }, { status: 404 });
  return NextResponse.json(record, { status: record.syncStatus === "synced" ? 200 : 502 });
});
