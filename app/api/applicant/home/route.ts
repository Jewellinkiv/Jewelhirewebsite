import { NextResponse } from "next/server";
import { requireApplicantSelf } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresApplicantHome } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export const GET = withApiErrorHandling(async function GET() {
  const { session, email } = await requireApplicantSelf("applicant.home");
  if (getStorageRuntime() === "postgres") {
    return NextResponse.json(await getPostgresApplicantHome(email, session));
  }
  return NextResponse.json(getApplicantStore().getApplicantHome(email));
});
