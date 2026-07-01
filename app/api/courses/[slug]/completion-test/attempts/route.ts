import { NextResponse } from "next/server";
import { getAssessmentStore } from "@/lib/server/stores/assessment-store";

export async function GET(_request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const attempts = await getAssessmentStore().listCourseTestAttempts({ courseSlug: params.slug });
  return NextResponse.json({ courseSlug: params.slug, count: attempts.length, attempts });
}

export async function POST(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const answers = Array.isArray(body?.answers) ? body.answers : [];
  if (answers.length === 0) return NextResponse.json({ error: "answers are required" }, { status: 400 });

  const result = await getAssessmentStore().submitCourseTestAttempt({
    courseSlug: params.slug,
    assignmentId: body?.assignmentId,
    recipientId: body?.recipientId,
    answers,
  });
  if (!result) return NextResponse.json({ error: "Course completion test not found" }, { status: 404 });
  return NextResponse.json(result, { status: 201 });
}
