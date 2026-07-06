import { NextResponse } from "next/server";
import { PUBLIC_JOBS } from "@/lib/applicant-lifecycle";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresJobDetail, updatePostgresStoreJob } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  if (getStorageRuntime() === "postgres") {
    const detail = await getPostgresJobDetail(params.slug);
    if (!detail) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    await requireStoreAccess(detail.job.storeId, "jobs.detail");
    return NextResponse.json(detail);
  }

  const job = PUBLIC_JOBS.find((item) => item.id === params.slug || item.id.replace(/^job-/, "") === params.slug);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const store = getApplicantStore();
  const applications = (await store.listStoreApplications({ storeId: job.storeId }))
    .filter((application) => application.jobId === job.id)
    .map(store.summarizeApplication);

  return NextResponse.json({
    job,
    applicants: applications,
    kpis: {
      total: applications.length,
      unique: new Set(applications.map((item) => item.application.applicantProfileId)).size,
      hired: applications.filter((item) => item.application.stage === "hired").length,
      activePipeline: applications.filter((item) => !["hired", "rejected", "withdrawn"].includes(item.application.stage)).length,
    },
  });
});

export const PATCH = withApiErrorHandling(async function PATCH(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  if (getStorageRuntime() !== "postgres") {
    return NextResponse.json({ error: "Local job updates are not wired yet" }, { status: 501 });
  }

  const current = await getPostgresJobDetail(params.slug);
  if (!current) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  await requireStoreAccess(current.job.storeId, "jobs.update");

  const body = await request.json().catch(() => null);
  const detail = await updatePostgresStoreJob({
    jobId: current.job.id,
    storeId: current.job.storeId,
    title: typeof body?.title === "string" ? body.title : undefined,
    location: typeof body?.location === "string" ? body.location : undefined,
    employmentType: typeof body?.employmentType === "string" ? body.employmentType : undefined,
    compensationSummary: typeof body?.compensationSummary === "string" ? body.compensationSummary : undefined,
    description: typeof body?.description === "string" ? body.description : undefined,
    requirements: Array.isArray(body?.requirements) ? body.requirements : undefined,
    idealGemMatchMix: Array.isArray(body?.idealGemMatchMix) ? body.idealGemMatchMix : undefined,
    requiredAssessmentIds: Array.isArray(body?.requiredAssessmentIds) ? body.requiredAssessmentIds : undefined,
    requiredCourseIds: Array.isArray(body?.requiredCourseIds) ? body.requiredCourseIds : undefined,
    status: body?.status,
  });
  if (!detail) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json(detail);
});
