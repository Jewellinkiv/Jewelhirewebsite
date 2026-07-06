import { NextResponse } from "next/server";
import { InterviewStatus } from "@/lib/applicant-lifecycle";
import { requireApplicantSelf } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { listPostgresApplicantInterviews } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

const statuses: InterviewStatus[] = ["scheduled", "completed", "cancelled", "no_show"];

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(request: Request) {
  const { email } = await requireApplicantSelf("applicant.interviews");
  const url = new URL(request.url);
  const status = statuses.includes(url.searchParams.get("status") as InterviewStatus)
    ? (url.searchParams.get("status") as InterviewStatus)
    : undefined;
  if (getStorageRuntime() === "postgres") {
    const items = await listPostgresApplicantInterviews(email, status);
    return NextResponse.json({ count: items.length, items });
  }

  const interviews = getApplicantStore().listApplicantInterviews(email);
  const items = status ? interviews.filter((interview) => interview.status === status) : interviews;
  return NextResponse.json({ count: items.length, items });
});
