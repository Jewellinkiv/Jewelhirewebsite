import { NextResponse } from "next/server";
import { AssessmentKind } from "@/lib/custom-assessments";
import { getAssessmentStore } from "@/lib/server/stores/assessment-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

const kinds: AssessmentKind[] = ["Knowledge check", "Trait profile", "Skills check"];

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const items = await getAssessmentStore().listStoreAssessments(params.storeId);
  return NextResponse.json({ count: items.length, items });
});

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description : "";
  const kind = kinds.includes(body?.kind) ? body.kind : "Knowledge check";
  const questions = Array.isArray(body?.questions) ? body.questions : [];
  const status = body?.status === "Published" ? "Published" : "Draft";
  if (!title || questions.length === 0) {
    return NextResponse.json({ error: "title and at least one question are required" }, { status: 400 });
  }
  const assessment = await getAssessmentStore().createStoreAssessment({ storeId: params.storeId, title, description, kind, questions, status });
  return NextResponse.json({ assessment }, { status: 201 });
});
