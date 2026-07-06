import { NextResponse } from "next/server";
import { getRoleTemplate, updateRoleTemplate } from "@/lib/role-templates";
import { AccessDeniedError, getSessionContext } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ role: string }> }) {
  const params = await props.params;
  const template = getRoleTemplate(params.role);
  if (!template) return NextResponse.json({ error: "Role template not found" }, { status: 404 });
  return NextResponse.json({ template });
});

export const PATCH = withApiErrorHandling(async function PATCH(request: Request, props: { params: Promise<{ role: string }> }) {
  const params = await props.params;
  const session = await getSessionContext();
  if (session.role !== "admin" && session.role !== "store_owner") {
    throw new AccessDeniedError("Admin or store owner role required for role_templates.update");
  }
  const existing = getRoleTemplate(params.role);
  if (!existing) return NextResponse.json({ error: "Role template not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const template = updateRoleTemplate(existing.role, {
    title: typeof body?.title === "string" ? body.title : undefined,
    location: typeof body?.location === "string" ? body.location : undefined,
    status: ["Active", "Draft", "Paused"].includes(body?.status) ? body.status : undefined,
    openings: Number.isFinite(Number(body?.openings)) ? Number(body.openings) : undefined,
    pipeline: Number.isFinite(Number(body?.pipeline)) ? Number(body.pipeline) : undefined,
    idealMix: body?.idealMix && typeof body.idealMix === "object" ? body.idealMix : undefined,
    priority: typeof body?.priority === "string" ? body.priority : undefined,
    assessments: Array.isArray(body?.assessments) ? body.assessments : undefined,
    courses: Array.isArray(body?.courses) ? body.courses : undefined,
    notes: typeof body?.notes === "string" ? body.notes : undefined,
  });
  return NextResponse.json({ template });
});
