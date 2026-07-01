import { NextResponse } from "next/server";
import { PROFILES, ProfileCode } from "@/lib/gemmatch";
import { getTeamStore } from "@/lib/server/stores/team-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const url = new URL(request.url);
  const locationId = url.searchParams.get("locationId");
  const teamStore = getTeamStore();
  const members = await teamStore.listStoreTeamMembers({ storeId: params.storeId, locationId });
  const counts = members.reduce<Record<ProfileCode, number>>(
    (acc, member) => {
      acc[member.primary] += 1;
      return acc;
    },
    { V: 0, C: 0, F: 0, D: 0 },
  );
  const composition = await teamStore.getTeamComposition({ storeId: params.storeId, locationId });

  return NextResponse.json({
    storeId: params.storeId,
    floorType: composition.floorType,
    mix: composition.mix,
    members,
    counts,
    labels: PROFILES,
  });
});
