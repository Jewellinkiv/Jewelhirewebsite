import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { getTeamStore } from "@/lib/server/stores/team-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "team_composition.read");
  const url = new URL(request.url);
  const composition = await getTeamStore().getTeamComposition({ storeId, locationId: url.searchParams.get("locationId") });
  return NextResponse.json({
    storeId,
    ...composition,
  });
});
