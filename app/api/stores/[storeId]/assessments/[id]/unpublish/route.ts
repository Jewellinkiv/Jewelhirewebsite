import { NextResponse } from "next/server";
import { getAssessmentStore } from "@/lib/server/stores/assessment-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const POST = withApiErrorHandling(async function POST(_request: Request, props: { params: Promise<{ storeId: string; id: string }> }) {
  const params = await props.params;
  const assessment = await getAssessmentStore().setStoreAssessmentStatus({
    storeId: params.storeId,
    assessmentId: params.id,
    status: "Draft",
  });
  if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  return NextResponse.json({ assessment });
});
