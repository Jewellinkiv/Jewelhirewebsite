import { NextResponse } from "next/server";
import { ManagerUser, UserRole } from "@/lib/users";
import { getSettingsStore } from "@/lib/server/stores/settings-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

const roles: UserRole[] = ["Admin", "Supervisor"];
const statuses: ManagerUser["status"][] = ["Active", "Invited"];

export const PATCH = withApiErrorHandling(async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const result = await getSettingsStore().updateStoreUser({
    userId: params.id,
    role: roles.includes(body?.role) ? body.role : undefined,
    status: statuses.includes(body?.status) ? body.status : undefined,
  });
  if (!result) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(result);
});

export const DELETE = withApiErrorHandling(async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const result = await getSettingsStore().removeStoreUser(params.id);
  if (!result) return NextResponse.json({ error: "User not found or cannot remove admin owner" }, { status: 404 });
  return NextResponse.json(result);
});
