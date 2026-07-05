import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getAdminStore } from "@/lib/server/stores/admin-store";

export const dynamic = "force-dynamic";

const KINDS = ["Trait profile", "Aptitude", "Knowledge check"] as const;

export const PATCH = withApiErrorHandling(async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  await requireAdminAccess("admin.assessments.update");
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (KINDS.includes(body.kind)) patch.kind = body.kind;
  if (typeof body.scope === "string") patch.scope = body.scope;
  if (body.status === "Published" || body.status === "Draft") patch.status = body.status;
  if (Number.isFinite(body.questions)) patch.questions = Number(body.questions);
  if (typeof body.note === "string") patch.note = body.note;

  const assessment = await getAdminStore().updateAssessment(params.id, patch);
  if (!assessment) {
    return NextResponse.json({ error: { code: "not_found", message: "Assessment not found." } }, { status: 404 });
  }
  return NextResponse.json({ assessment });
});

export const DELETE = withApiErrorHandling(async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  await requireAdminAccess("admin.assessments.delete");
  const result = await getAdminStore().removeAssessment(params.id);
  if (!result) {
    return NextResponse.json(
      { error: { code: "not_allowed", message: "This assessment can't be deleted." } },
      { status: 400 },
    );
  }
  return NextResponse.json(result);
});
