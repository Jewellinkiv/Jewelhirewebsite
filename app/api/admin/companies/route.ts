import { NextResponse } from "next/server";
import { PlanTier } from "@/lib/admin";
import { requireAdminAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getAdminStore } from "@/lib/server/stores/admin-store";
import { assertTeamInvitesEnabled, teamInvitesEnabled } from "@/lib/server/team-invite-policy";

const plans: PlanTier[] = ["Starter", "Growth", "Pro"];

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(request: Request) {
  await requireAdminAccess("admin.companies.list");
  const url = new URL(request.url);
  const items = await getAdminStore().listCompanies(url.searchParams.get("q") ?? "");
  return NextResponse.json({
    count: items.length,
    items,
    capabilities: { teamInvitesEnabled: teamInvitesEnabled() },
  });
});

export const POST = withApiErrorHandling(async function POST(request: Request) {
  await requireAdminAccess("admin.companies.create");
  assertTeamInvitesEnabled();
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const owner = typeof body?.owner === "string" ? body.owner.trim() : "";
  const ownerEmail = typeof body?.ownerEmail === "string" ? body.ownerEmail.trim() : undefined;
  const plan = plans.includes(body?.plan) ? body.plan : "Starter";
  if (!name || !owner) {
    return NextResponse.json({ error: "Company name and owner are required" }, { status: 400 });
  }

  const company = await getAdminStore().createCompany({ name, owner, ownerEmail, plan });
  return NextResponse.json({ company }, { status: 201 });
});
