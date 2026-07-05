import { NextRequest, NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getCourseAdmin, removeCourse, toStoreCourse, updateCourse, type CourseModuleInput } from "@/lib/courses";

export const dynamic = "force-dynamic";

// Confirm the course exists AND belongs to this store — a store owner may only
// touch their own org-specific courses, never global admin ones or another
// store's.
function ownedByStore(id: string, storeId: string) {
  const course = getCourseAdmin(id);
  return course && course.owner === "Store" && course.storeId === storeId ? course : null;
}

export const PATCH = withApiErrorHandling(async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ storeId: string; id: string }> },
) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "courses.update");
  if (!ownedByStore(params.id, storeId)) {
    return NextResponse.json({ error: { code: "not_found", message: "Course not found." } }, { status: 404 });
  }
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
  return NextResponse.json({ course: course ? toStoreCourse(course) : null });
});

export const DELETE = withApiErrorHandling(async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ storeId: string; id: string }> },
) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "courses.delete");
  if (!ownedByStore(params.id, storeId)) {
    return NextResponse.json({ error: { code: "not_found", message: "Course not found." } }, { status: 404 });
  }
  removeCourse(params.id);
  return NextResponse.json({ deleted: true });
});
