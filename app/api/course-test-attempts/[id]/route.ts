import { NextResponse } from "next/server";
import { getAssessmentStore } from "@/lib/server/stores/assessment-store";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const attempt = await getAssessmentStore().getCourseTestAttempt(params.id);
  if (!attempt) return NextResponse.json({ error: "Course test attempt not found" }, { status: 404 });
  return NextResponse.json({ attempt });
}
