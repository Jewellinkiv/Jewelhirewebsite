import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getAttempt } from "@/lib/local-assessment-store";
import {
  getPostgresAssessmentResult,
  getPostgresAssessmentResultStoreId,
} from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export const GET = withApiErrorHandling(async function GET(
  _request: Request,
  props: { params: Promise<{ attemptId: string }> },
) {
  const params = await props.params;

  if (getStorageRuntime() === "postgres") {
    const storeId = await getPostgresAssessmentResultStoreId(params.attemptId);
    if (!storeId) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    await requireStoreAccess(storeId, "assessments.read");
    const attempt = await getPostgresAssessmentResult(params.attemptId);
    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    return NextResponse.json({ attempt });
  }

  const attempt = getAttempt(params.attemptId);
  if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  return NextResponse.json({ attempt });
});
