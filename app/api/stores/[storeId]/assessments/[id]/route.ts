import { NextResponse } from "next/server";
import { getAssessmentStore } from "@/lib/server/stores/assessment-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const PATCH = withApiErrorHandling(async function PATCH(request: Request, props: { params: Promise<{ storeId: string; id: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const assessment = await getAssessmentStore().updateStoreAssessment({
    storeId: params.storeId,
    assessmentId: params.id,
    assessment: body || {},
  });
  if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  return NextResponse.json({ assessment });
});

export const DELETE = withApiErrorHandling(async function DELETE(_request: Request, props: { params: Promise<{ storeId: string; id: string }> }) {
  const params = await props.params;
  const assessment = await getAssessmentStore().deleteStoreAssessment({ storeId: params.storeId, assessmentId: params.id });
  if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  return NextResponse.json({ assessment });
});
