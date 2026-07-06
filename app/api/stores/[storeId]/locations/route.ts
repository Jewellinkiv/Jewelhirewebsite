import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { getTeamStore } from "@/lib/server/stores/team-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "locations.list");
  const items = await getTeamStore().listStoreLocations(storeId);
  return NextResponse.json({ count: items.length, items });
});
