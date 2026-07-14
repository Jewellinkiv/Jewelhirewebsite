import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { notifyTeamUserInvited } from "@/lib/server/notifications";
import { getAdminStore } from "@/lib/server/stores/admin-store";
import { assertTeamInvitesEnabled } from "@/lib/server/team-invite-policy";

export const dynamic = "force-dynamic";

export const POST = withApiErrorHandling(async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requireAdminAccess("admin.users.resend");
  assertTeamInvitesEnabled();
  const result = await getAdminStore().resendUserInvite(params.id);
  if (!result) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const notification = await notifyTeamUserInvited({
    toEmail: result.user.email,
    recipientName: result.user.name,
    role: result.user.role,
    organizationName: result.company.name,
    scope: "company",
    companyId: result.company.id,
    resent: true,
  });
  return NextResponse.json({ ...result, notification });
});
