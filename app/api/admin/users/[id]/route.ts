import { NextResponse } from "next/server";
import { AdminCompanyUser } from "@/lib/admin";
import { requireAdminAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getAdminStore } from "@/lib/server/stores/admin-store";
import { assertTeamInvitesEnabled } from "@/lib/server/team-invite-policy";

const roles: AdminCompanyUser["role"][] = ["Admin", "Supervisor"];
const statuses: AdminCompanyUser["status"][] = ["Active", "Invited"];

export const dynamic = "force-dynamic";

export const PATCH = withApiErrorHandling(async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requireAdminAccess("admin.users.update");
  assertTeamInvitesEnabled();
  const body = await request.json().catch(() => null);
  const result = await getAdminStore().updateUser({
    userId: params.id,
    role: roles.includes(body?.role) ? body.role : undefined,
    status: statuses.includes(body?.status) ? body.status : undefined,
  });
  if (!result) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(result);
});

export const DELETE = withApiErrorHandling(async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requireAdminAccess("admin.users.delete");
  const result = await getAdminStore().removeUser(params.id);
  if (!result) return NextResponse.json({ error: "User not found or cannot remove admin owner" }, { status: 404 });
  return NextResponse.json(result);
});
