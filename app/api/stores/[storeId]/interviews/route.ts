import { NextResponse } from "next/server";
import { InterviewStatus } from "@/lib/applicant-lifecycle";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { listPostgresStoreInterviews } from "@/lib/server/postgres-phase1";
import { listStoreInterviews } from "@/lib/local-api-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { locationInScope } from "@/lib/server/location-scope";

const statuses: InterviewStatus[] = ["scheduled", "completed", "cancelled", "no_show"];

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const access = await requireLocationScopedStoreAccess(params.storeId, "interviews.list");
  const storeId = access.storeId;
  const url = new URL(request.url);
  const status = statuses.includes(url.searchParams.get("status") as InterviewStatus)
    ? (url.searchParams.get("status") as InterviewStatus)
    : undefined;
  if (getStorageRuntime() === "postgres") {
    const items = (await listPostgresStoreInterviews({ storeId, status }))
      .filter((item) => locationInScope(item.job?.location, access.locationIds));
    return NextResponse.json({ count: items.length, items });
  }

  const items = listStoreInterviews(storeId, status)
    .filter((item) => locationInScope(item.job?.location, access.locationIds));
  return NextResponse.json({ count: items.length, items });
});
