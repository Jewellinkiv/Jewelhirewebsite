import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getAssessmentStore } from "@/lib/server/stores/assessment-store";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  await requireStoreAccess(params.storeId, "assessment_results.list");
  const items = await getAssessmentStore().listAssessmentResults(params.storeId);
  return NextResponse.json({ count: items.length, items });
});
