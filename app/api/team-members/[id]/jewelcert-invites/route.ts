import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getTeamStore } from "@/lib/server/stores/team-store";

export const POST = withApiErrorHandling(async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const result = await getTeamStore().updateTeamMember({ memberId: params.id, nextAction: "JewelCert invite sent" });
  if (!result) return NextResponse.json({ error: "Team member not found" }, { status: 404 });
  return NextResponse.json({
    invite: {
      id: `team-gemmatch-${params.id}-${Date.now().toString(36)}`,
      teamMemberId: params.id,
      status: "sent",
      sentAt: new Date().toISOString(),
    },
    member: result.member,
  }, { status: 201 });
});
