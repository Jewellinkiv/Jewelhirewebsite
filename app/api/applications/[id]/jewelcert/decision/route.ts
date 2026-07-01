import { NextResponse } from "next/server";
import { getAssessmentStore } from "@/lib/server/stores/assessment-store";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const decision = typeof body?.decision === "string" ? body.decision : "";
  const note = typeof body?.note === "string" ? body.note : "";
  if (!decision) return NextResponse.json({ error: "decision is required" }, { status: 400 });
  const record = await getAssessmentStore().createJewelCertDecision(params.id, { decision, note });
  if (!record) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  return NextResponse.json({ decision: record }, { status: 201 });
}
