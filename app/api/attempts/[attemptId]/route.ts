import { NextResponse } from "next/server";
import { getAssessmentStore } from "@/lib/server/stores/assessment-store";

export async function GET(_request: Request, props: { params: Promise<{ attemptId: string }> }) {
  const params = await props.params;
  const attempt = await getAssessmentStore().getAttempt(params.attemptId);
  if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  return NextResponse.json({ attempt });
}
