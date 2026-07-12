import { NextResponse } from "next/server";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { requireLocationInScope } from "@/lib/server/location-scope";
import { getPostgresJobDetail, updatePostgresStoreJob } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export const dynamic = "force-dynamic";

export const POST = withApiErrorHandling(async function POST(_request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  if (getStorageRuntime() !== "postgres") {
    return NextResponse.json({ error: "Local job updates are not wired yet" }, { status: 501 });
  }
  const current = await getPostgresJobDetail(params.slug);
  if (!current) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const access = await requireLocationScopedStoreAccess(current.job.storeId, "jobs.update");
  requireLocationInScope(current.job.location, access.locationIds, "jobs.update");
  const detail = await updatePostgresStoreJob({ jobId: current.job.id, storeId: current.job.storeId, status: "closed" });
  return NextResponse.json(detail);
});
