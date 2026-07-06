import { NextResponse } from "next/server";
import { requireApplicantSelf } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { listPostgresApplicantApplications } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export const GET = withApiErrorHandling(async function GET() {
  const { email } = await requireApplicantSelf("applicant.applications");
  const items =
    getStorageRuntime() === "postgres"
      ? await listPostgresApplicantApplications(email)
      : getApplicantStore().listApplicantApplications(email);
  return NextResponse.json({ count: items.length, items });
});
