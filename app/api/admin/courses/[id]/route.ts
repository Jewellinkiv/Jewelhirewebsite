import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getCourseAdmin, removeCourse, updateCourse, type CourseModuleInput } from "@/lib/courses";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  await requireAdminAccess("admin.courses.get");
  const course = getCourseAdmin(params.id);
  if (!course) return NextResponse.json({ error: { code: "not_found", message: "Course not found." } }, { status: 404 });
  return NextResponse.json({ course });
});

export const PATCH = withApiErrorHandling(async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  await requireAdminAccess("admin.courses.update");
  const body = await request.json().catch(() => ({}));
  const patch: {
    title?: string;
    description?: string;
    badgeLabel?: string;
    status?: "Draft" | "Published";
    modules?: CourseModuleInput[];
  } = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.description === "string") patch.description = body.description;
  if (typeof body.badgeLabel === "string") patch.badgeLabel = body.badgeLabel;
  if (body.status === "Published" || body.status === "Draft") patch.status = body.status;
  if (Array.isArray(body.modules)) patch.modules = body.modules;

  const course = updateCourse(params.id, patch);
  if (!course) return NextResponse.json({ error: { code: "not_found", message: "Course not found." } }, { status: 404 });
  return NextResponse.json({ course });
});

export const DELETE = withApiErrorHandling(async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  await requireAdminAccess("admin.courses.delete");
  const result = removeCourse(params.id);
  if (!result) return NextResponse.json({ error: { code: "not_found", message: "Course not found." } }, { status: 404 });
  return NextResponse.json(result);
});
