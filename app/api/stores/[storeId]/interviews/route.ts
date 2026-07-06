import { NextResponse } from "next/server";
import { InterviewStatus } from "@/lib/applicant-lifecycle";
import { requireStoreAccess } from "@/lib/server/access-control";
import { listPostgresStoreInterviews } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { withApiErrorHandling } from "@/lib/server/api-errors";

const statuses: InterviewStatus[] = ["scheduled", "completed", "cancelled", "no_show"];

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "interviews.list");
  const url = new URL(request.url);
  const status = statuses.includes(url.searchParams.get("status") as InterviewStatus)
    ? (url.searchParams.get("status") as InterviewStatus)
    : undefined;
  if (getStorageRuntime() === "postgres") {
    return listPostgresStoreInterviews({ storeId, status }).then((items) =>
      NextResponse.json({ count: items.length, items }),
    );
  }

  const items = await getApplicantStore().listStoreInterviews({ storeId, status });
  return NextResponse.json({ count: items.length, items });
});
