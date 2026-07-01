import { NextResponse } from "next/server";
import { InterviewStatus } from "@/lib/applicant-lifecycle";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { listPostgresApplicantInterviews } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

const statuses: InterviewStatus[] = ["scheduled", "completed", "cancelled", "no_show"];

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(request: Request) {
  const url = new URL(request.url);
  const status = statuses.includes(url.searchParams.get("status") as InterviewStatus)
    ? (url.searchParams.get("status") as InterviewStatus)
    : undefined;
  if (getStorageRuntime() === "postgres") {
    const items = await listPostgresApplicantInterviews(url.searchParams.get("email"), status);
    return NextResponse.json({ count: items.length, items });
  }

  const interviews = getApplicantStore().listApplicantInterviews(url.searchParams.get("email"));
  const items = status ? interviews.filter((interview) => interview.status === status) : interviews;
  return NextResponse.json({ count: items.length, items });
});
