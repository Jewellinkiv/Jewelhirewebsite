import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getSessionContext } from "@/lib/server/access-control";
import { completeCourse } from "@/lib/courses";

export const dynamic = "force-dynamic";

// Grade any quiz answers server-side; if everything passes, award the badge.
// Body: { quizAnswers: { [moduleId]: number[] } } where each entry is the
// selected option index per question.
export const POST = withApiErrorHandling(async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const body = await request.json().catch(() => ({}));
  const quizAnswers =
    body && typeof body.quizAnswers === "object" && body.quizAnswers !== null
      ? (body.quizAnswers as Record<string, number[]>)
      : {};
  // Award the badge to the signed-in learner (if any) so it lands on their profile.
  const session = await getSessionContext().catch(() => null);
  const result = completeCourse(params.id, quizAnswers, session?.userId);
  if (!result) return NextResponse.json({ error: { code: "not_found", message: "Course not found." } }, { status: 404 });
  return NextResponse.json(result);
});
