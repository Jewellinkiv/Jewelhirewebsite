import { NextResponse } from "next/server";
import { getAssessmentStore } from "@/lib/server/stores/assessment-store";
import { getCourse } from "@/lib/training-center";

export async function GET(_request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const course = getCourse(params.slug);
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const test = await getAssessmentStore().getCourseCompletionTestForLearner(params.slug);
  if (!test) return NextResponse.json({ courseSlug: params.slug, test: null });

  return NextResponse.json({ courseSlug: params.slug, test });
}
