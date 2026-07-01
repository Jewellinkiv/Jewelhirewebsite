import { NextResponse } from "next/server";
import { getAssessmentStore } from "@/lib/server/stores/assessment-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await getAssessmentStore().listCourseCompletionTests();
  return NextResponse.json({
    count: items.length,
    withTests: items.filter((item) => item.test).length,
    items,
  });
}
