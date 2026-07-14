import { NextResponse } from "next/server";
import { requireApplicantSelf } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { listPostgresApplicantInvites } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export const GET = withApiErrorHandling(async function GET(request: Request) {
  const { session, email } = await requireApplicantSelf("applicant.invites");
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const items =
    getStorageRuntime() === "postgres"
      ? await listPostgresApplicantInvites(email, status, session)
      : getApplicantStore().listApplicantInvites(email).filter((invite) => !status || invite.status === status);
  return NextResponse.json({ count: items.length, items });
});
