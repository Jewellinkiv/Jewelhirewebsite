import { NextResponse } from "next/server";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { getPostgresApplicationDetail, listPostgresStoreJewelCertInvites } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { locationInScope } from "@/lib/server/location-scope";
import { getApplicationDetail, listStoreJewelCertInvites } from "@/lib/local-api-store";

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const access = await requireLocationScopedStoreAccess(params.storeId, "jewelcert_invites.list");
  const storeId = access.storeId;
  const allItems = getStorageRuntime() === "postgres"
    ? await listPostgresStoreJewelCertInvites(storeId)
    : listStoreJewelCertInvites(storeId);
  const scopedItems = (await Promise.all(allItems.map(async (item) => {
    const detail = getStorageRuntime() === "postgres"
      ? await getPostgresApplicationDetail({ applicationId: item.invite.applicationId, storeId })
      : getApplicationDetail(item.invite.applicationId);
    return locationInScope(detail?.job?.location || detail?.profile?.location, access.locationIds) ? item : undefined;
  }))).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const items = scopedItems
    .filter((item) => !status || item.status.toLowerCase() === status.toLowerCase());
  return NextResponse.json({ count: items.length, items });
});
