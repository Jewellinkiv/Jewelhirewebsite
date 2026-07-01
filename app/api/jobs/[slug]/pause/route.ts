import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
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
  await requireStoreAccess(current.job.storeId, "jobs.update");
  const detail = await updatePostgresStoreJob({ jobId: current.job.id, status: "paused" });
  return NextResponse.json(detail);
});
