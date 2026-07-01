import { NextResponse } from "next/server";
import { getAssessmentStore } from "@/lib/server/stores/assessment-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const attempts = await getAssessmentStore().listCourseTestAttempts({
    assignmentId: url.searchParams.get("assignmentId"),
    courseSlug: url.searchParams.get("courseSlug"),
  });
  return NextResponse.json({ count: attempts.length, attempts });
}
