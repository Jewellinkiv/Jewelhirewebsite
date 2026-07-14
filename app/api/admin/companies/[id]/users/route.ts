import { NextResponse } from "next/server";
import { AdminCompanyUser } from "@/lib/admin";
import { requireAdminAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { notifyTeamUserInvited } from "@/lib/server/notifications";
import { getAdminStore } from "@/lib/server/stores/admin-store";
import { assertTeamInvitesEnabled } from "@/lib/server/team-invite-policy";

const roles: AdminCompanyUser["role"][] = ["Admin", "Supervisor"];

export const dynamic = "force-dynamic";

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requireAdminAccess("admin.company_users.invite");
  assertTeamInvitesEnabled();
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const role = roles.includes(body?.role) ? body.role : "Supervisor";
  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const result = await getAdminStore().inviteCompanyUser({ companyId: params.id, name, email, role });
  if (!result) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  const notification = await notifyTeamUserInvited({
    toEmail: result.user.email,
    recipientName: result.user.name,
    role: result.user.role,
    organizationName: result.company.name,
    scope: "company",
    companyId: params.id,
  });
  return NextResponse.json({ ...result, notification }, { status: 201 });
});
