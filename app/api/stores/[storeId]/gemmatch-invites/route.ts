import { NextResponse } from "next/server";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresApplicationDetail, listPostgresStoreGemMatchInvites } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicationDetail, listStoreGemMatchInvites } from "@/lib/local-api-store";
import { locationInScope } from "@/lib/server/location-scope";

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const url = new URL(request.url);
  const access = await requireLocationScopedStoreAccess(params.storeId, "gemmatch_invites.list");
  const storeId = access.storeId;
  const candidates = getStorageRuntime() === "postgres"
    ? await listPostgresStoreGemMatchInvites(storeId, url.searchParams.get("status"))
    : listStoreGemMatchInvites(storeId, url.searchParams.get("status"));
  const items = (await Promise.all(candidates.map(async (item) => {
    const detail = getStorageRuntime() === "postgres"
      ? await getPostgresApplicationDetail({ applicationId: item.invite.applicationId, storeId })
      : getApplicationDetail(item.invite.applicationId);
    return locationInScope(detail?.job?.location || detail?.profile?.location, access.locationIds) ? item : undefined;
  }))).filter((item): item is NonNullable<typeof item> => Boolean(item));
  return NextResponse.json({ count: items.length, items });
});
