import { NextResponse } from "next/server";
import { getTeamStore } from "@/lib/server/stores/team-store";

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const result = await getTeamStore().updateTeamMember({
    memberId: params.id,
    locationId: typeof body?.locationId === "string" ? body.locationId : undefined,
    status: typeof body?.status === "string" ? body.status : undefined,
    nextAction: typeof body?.nextAction === "string" ? body.nextAction : undefined,
  });
  if (!result) return NextResponse.json({ error: "Team member not found" }, { status: 404 });
  return NextResponse.json(result);
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const result = await getTeamStore().removeTeamMember(params.id);
  if (!result) return NextResponse.json({ error: "Team member not found" }, { status: 404 });
  return NextResponse.json(result);
}
