import { NextResponse } from "next/server";
import { UserRole } from "@/lib/users";
import { notifyTeamUserInvited } from "@/lib/server/notifications";
import { getSettingsStore } from "@/lib/server/stores/settings-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

const roles: UserRole[] = ["Admin", "Supervisor"];

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const users = await getSettingsStore().listStoreUsers(params.storeId);
  return NextResponse.json({ count: users.length, items: users });
});

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const role = roles.includes(body?.role) ? body.role : "Supervisor";
  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const result = await getSettingsStore().inviteStoreUser({ storeId: params.storeId, name, email, role });
  if (!result) return NextResponse.json({ error: "Unable to invite user" }, { status: 404 });
  const notification = await notifyTeamUserInvited({
    toEmail: result.user.email,
    recipientName: result.user.name,
    role: result.user.role,
    organizationName: params.storeId,
    scope: "store",
    storeId: params.storeId,
  });
  return NextResponse.json({ ...result, notification }, { status: 201 });
});
