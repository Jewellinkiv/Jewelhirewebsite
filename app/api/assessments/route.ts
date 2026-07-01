import { NextResponse } from "next/server";
import { getAssessmentStore } from "@/lib/server/stores/assessment-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getAssessmentStore().listAssessmentCatalog());
}
