import { NextResponse } from "next/server";
import { PUBLIC_JOBS } from "@/lib/applicant-lifecycle";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresJobDetail } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  if (getStorageRuntime() === "postgres") {
    const detail = await getPostgresJobDetail(params.slug);
    if (!detail) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    await requireStoreAccess(detail.job.storeId, "jobs.applicants");
    return NextResponse.json({ jobId: detail.job.id, count: detail.applicants.length, items: detail.applicants });
  }

  const job = PUBLIC_JOBS.find((item) => item.id === params.slug || item.id.replace(/^job-/, "") === params.slug);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const store = getApplicantStore();
  const items = (await store.listStoreApplications({ storeId: job.storeId }))
    .filter((application) => application.jobId === job.id)
    .map(store.summarizeApplication);

  return NextResponse.json({ jobId: job.id, count: items.length, items });
});
