import { NextResponse } from "next/server";
import { CompanyStatus, PlanTier } from "@/lib/admin";
import { requireAdminAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getAdminStore } from "@/lib/server/stores/admin-store";

const plans: PlanTier[] = ["Starter", "Growth", "Pro"];
const statuses: CompanyStatus[] = ["Active", "Trial", "Suspended"];

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requireAdminAccess("admin.companies.detail");
  const company = await getAdminStore().getCompany(params.id);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  return NextResponse.json({ company });
});

export const PATCH = withApiErrorHandling(async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requireAdminAccess("admin.companies.update");
  const body = await request.json().catch(() => null);
  const company = await getAdminStore().updateCompany({
    companyId: params.id,
    plan: plans.includes(body?.plan) ? body.plan : undefined,
    status: statuses.includes(body?.status) ? body.status : undefined,
  });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  return NextResponse.json({ company });
});

export const DELETE = withApiErrorHandling(async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requireAdminAccess("admin.companies.delete");
  const result = await getAdminStore().removeCompany(params.id);
  if (!result) return NextResponse.json({ error: "Company not found or protected" }, { status: 404 });
  return NextResponse.json(result);
});
