import { NextRequest, NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { createCourse, listStoreCourses, toStoreCourse, type CourseModuleInput } from "@/lib/courses";

export const dynamic = "force-dynamic";

const TYPES = ["video", "quiz", "upload"] as const;

export const GET = withApiErrorHandling(async function GET(
  _request: NextRequest,
  props: { params: Promise<{ storeId: string }> },
) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "courses.list");
  const items = listStoreCourses(storeId);
  return NextResponse.json({ count: items.length, items });
});

export const POST = withApiErrorHandling(async function POST(
  request: NextRequest,
  props: { params: Promise<{ storeId: string }> },
) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "courses.create");
  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: { code: "invalid", message: "A course title is required." } }, { status: 400 });
  }
  const modules: CourseModuleInput[] = Array.isArray(body.modules)
    ? body.modules
        .filter((m: { type?: string }) => m && TYPES.includes(m.type as (typeof TYPES)[number]))
        .map((m: CourseModuleInput) => ({
          type: m.type,
          title: typeof m.title === "string" ? m.title : "",
          videoUrl: m.videoUrl,
          instructions: m.instructions,
          questions: Array.isArray(m.questions) ? m.questions : undefined,
          passingCount: m.passingCount,
        }))
    : [];
  if (modules.length === 0) {
    return NextResponse.json({ error: { code: "invalid", message: "Add at least one module." } }, { status: 400 });
  }
  const course = createCourse({
    title,
    description: typeof body.description === "string" ? body.description : "",
    badgeLabel: typeof body.badgeLabel === "string" ? body.badgeLabel : undefined,
    status: body.status === "Published" ? "Published" : "Draft",
    owner: "Store",
    storeId,
    modules,
  });
  return NextResponse.json({ course: toStoreCourse(course) }, { status: 201 });
});
