import { NextResponse } from "next/server";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { requireLocationInScope } from "@/lib/server/location-scope";
import { listApplicationJewelCertResults } from "@/lib/local-assessment-store";
import {
  getPostgresApplicationDetail,
  getPostgresApplicationStoreId,
  listPostgresApplicationJewelCertResults,
} from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicationDetail } from "@/lib/local-api-store";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;

  if (getStorageRuntime() === "postgres") {
    const storeId = await getPostgresApplicationStoreId(params.id);
    if (!storeId) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    const access = await requireLocationScopedStoreAccess(storeId, "jewelcert.list");
    const detail = await getPostgresApplicationDetail({ applicationId: params.id, storeId });
    requireLocationInScope(detail?.job?.location || detail?.profile?.location, access.locationIds, "jewelcert.list");
    const items = await listPostgresApplicationJewelCertResults(params.id);
    return NextResponse.json({ applicationId: params.id, count: items.length, items });
  }

  const detail = getApplicationDetail(params.id);
  if (!detail) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  const access = await requireLocationScopedStoreAccess(detail.application.storeId, "jewelcert.list");
  requireLocationInScope(detail.job?.location || detail.profile?.location, access.locationIds, "jewelcert.list");
  const items = listApplicationJewelCertResults(params.id);
  return NextResponse.json({ applicationId: params.id, count: items.length, items });
});
