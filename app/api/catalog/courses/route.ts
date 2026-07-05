import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { listPublicCourses } from "@/lib/courses";

export const dynamic = "force-dynamic";

// Published courses, learner/store-safe (no answer keys, no admin-only counts).
export const GET = withApiErrorHandling(async function GET() {
  const items = listPublicCourses();
  return NextResponse.json({ count: items.length, items });
});
