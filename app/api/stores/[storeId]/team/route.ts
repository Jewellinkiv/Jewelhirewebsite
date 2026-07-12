import { NextResponse } from "next/server";
import { PROFILES, ProfileCode } from "@/lib/gemmatch";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { getTeamStore } from "@/lib/server/stores/team-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const { storeId } = await requireLocationScopedStoreAccess(params.storeId, "team.list");
  const url = new URL(request.url);
  const locationId = url.searchParams.get("locationId");
  const teamStore = getTeamStore();
  const members = await teamStore.listStoreTeamMembers({ storeId, locationId });
  const counts = members.reduce<Record<ProfileCode, number>>(
    (acc, member) => {
      acc[member.primary] += 1;
      return acc;
    },
    { V: 0, C: 0, F: 0, D: 0 },
  );
  const composition = await teamStore.getTeamComposition({ storeId, locationId });

  return NextResponse.json({
    storeId,
    floorType: composition.floorType,
    mix: composition.mix,
    members,
    counts,
    labels: PROFILES,
  });
});

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const { storeId } = await requireLocationScopedStoreAccess(params.storeId, "team.members.create");
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const rawPrimary = typeof body?.primary === "string" ? body.primary : "";
  const primary = (["V", "C", "F", "D"].includes(rawPrimary) ? rawPrimary : "C") as ProfileCode;
  const result = await getTeamStore().createTeamMember({
    storeId,
    name,
    role: typeof body?.role === "string" ? body.role : undefined,
    primary,
    type: typeof body?.type === "string" ? body.type : undefined,
    locationId: typeof body?.locationId === "string" ? body.locationId : undefined,
  });
  if (!result) return NextResponse.json({ error: "Team member could not be created" }, { status: 400 });
  return NextResponse.json(result, { status: 201 });
});
