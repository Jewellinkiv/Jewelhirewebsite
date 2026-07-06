import { NextResponse } from "next/server";
import { requireApplicantSelf } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { listPostgresApplicantTraining } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET() {
  const { email } = await requireApplicantSelf("applicant.training");
  if (getStorageRuntime() === "postgres") {
    const items = await listPostgresApplicantTraining(email);
    return NextResponse.json({ count: items.length, items });
  }

  const items = getApplicantStore().listApplicantTraining(email);
  return NextResponse.json({ count: items.length, items });
});
