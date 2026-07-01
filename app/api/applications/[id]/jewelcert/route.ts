import { NextResponse } from "next/server";
import { getAssessmentStore } from "@/lib/server/stores/assessment-store";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const items = await getAssessmentStore().listApplicationJewelCertResults(params.id);
  return NextResponse.json({ applicationId: params.id, count: items.length, items });
}
