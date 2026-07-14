import { NextResponse } from "next/server";
import { UserRole } from "@/lib/users";
import { notifyTeamUserInvited } from "@/lib/server/notifications";
import { getSettingsStore } from "@/lib/server/stores/settings-store";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { assertTeamInvitesEnabled, teamInvitesEnabled } from "@/lib/server/team-invite-policy";

const roles: UserRole[] = ["Admin", "Supervisor"];

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "users.list");
  const users = await getSettingsStore().listStoreUsers(storeId);
  return NextResponse.json({
    count: users.length,
    items: users,
    capabilities: { teamInvitesEnabled: teamInvitesEnabled() },
  });
});

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "users.invite");
  assertTeamInvitesEnabled();
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const role = roles.includes(body?.role) ? body.role : "Supervisor";
  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const result = await getSettingsStore().inviteStoreUser({ storeId, name, email, role });
  if (!result) return NextResponse.json({ error: "Unable to invite user" }, { status: 404 });

  // Resolve a human-readable organization name for the invite email so the
  // subject/body read e.g. "Sissy's Log Cabin — Little Rock, Arkansas" instead
  // of the raw store slug ("store-sissys-little-rock"). Best-effort: fall back
  // to the storeId if settings can't be read, so an invite never fails on this.
  let orgName = storeId;
  try {
    const settings = await getSettingsStore().getStoreSettings(storeId);
    const company = settings?.organization?.company?.trim();
    const primaryStore = settings?.organization?.primaryStore?.trim();
    if (company) orgName = primaryStore ? `${company} — ${primaryStore}` : company;
  } catch {
    orgName = storeId;
  }

  const notification = await notifyTeamUserInvited({
    toEmail: result.user.email,
    recipientName: result.user.name,
    role: result.user.role,
    organizationName: orgName,
    scope: "store",
    storeId,
  });
  return NextResponse.json({ ...result, notification }, { status: 201 });
});
