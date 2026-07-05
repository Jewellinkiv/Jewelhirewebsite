import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getSessionContext } from "@/lib/server/access-control";
import { getCourseStore } from "@/lib/server/stores/course-store";

export const dynamic = "force-dynamic";

// Published courses, learner/store-safe (no answer keys, no admin-only counts).
export const GET = withApiErrorHandling(async function GET() {
  await getSessionContext(); // any authenticated role; throws for anonymous in prod
  const items = await getCourseStore().listPublicCourses();
  return NextResponse.json({ count: items.length, items });
});
