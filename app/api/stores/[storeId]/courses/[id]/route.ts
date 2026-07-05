import { NextRequest, NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getCourseStore } from "@/lib/server/stores/course-store";
import { toStoreCourse, type CourseModuleInput } from "@/lib/courses";

export const dynamic = "force-dynamic";

// Confirm the course exists AND belongs to this store — a store owner may only
// touch their own org-specific courses, never global admin ones or another
// store's.
async function ownedByStore(id: string, storeId: string) {
  const course = await getCourseStore().getCourseAdmin(id);
  return course && course.owner === "Store" && course.storeId === storeId ? course : null;
}

export const PATCH = withApiErrorHandling(async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ storeId: string; id: string }> },
) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "courses.update");
  if (!(await ownedByStore(params.id, storeId))) {
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

  const course = await getCourseStore().updateCourse(params.id, patch);
  return NextResponse.json({ course: course ? toStoreCourse(course) : null });
});

export const DELETE = withApiErrorHandling(async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ storeId: string; id: string }> },
) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "courses.delete");
  if (!(await ownedByStore(params.id, storeId))) {
    return NextResponse.json({ error: { code: "not_found", message: "Course not found." } }, { status: 404 });
  }
  await getCourseStore().removeCourse(params.id);
  return NextResponse.json({ deleted: true });
});
