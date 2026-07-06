import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { getLocalStoreJob, updateLocalStoreJob, JobStatus } from "@/lib/local-job-store";
import { getPostgresJobDetail, updatePostgresStoreJob } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

const jobStatuses: JobStatus[] = ["draft", "open", "paused", "closed"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "NA";
}

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string; slug: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "jobs.read");

  if (getStorageRuntime() === "postgres") {
    const detail = await getPostgresJobDetail(params.slug, storeId);
    if (!detail || detail.job.storeId !== storeId) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    const applicants = detail.applicants.map((item) => ({
      applicationId: item.application.id,
      name: item.applicant.fullName,
      initials: initials(item.applicant.fullName),
      stage: item.application.stage,
      appliedDate: item.application.submittedAt || item.application.createdAt,
    }));
    const views = "views" in detail.job && typeof detail.job.views === "number" ? detail.job.views : 0;
    const applyClicks = "applyClicks" in detail.job && typeof detail.job.applyClicks === "number" ? detail.job.applyClicks : 0;
    return NextResponse.json({
      job: detail.job,
      kpis: {
        applicants: detail.kpis.total,
        uniqueApplicants: detail.kpis.unique,
        hired: detail.kpis.hired,
        activePipeline: detail.kpis.activePipeline,
        views,
        applyClicks,
        applyRate: views ? Math.round((applyClicks / views) * 100) : 0,
      },
      applicants,
    });
  }

  const job = getLocalStoreJob(storeId, params.slug);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const applications = await getApplicantStore().listStoreApplications({ storeId });
  const jobApplications = applications.filter((application) => application.jobId === job.id);
  const applicationIds = new Set(jobApplications.map((application) => application.id));
  const applicantRows = (await getApplicantStore().listStoreApplicants({ storeId })).filter((row) => applicationIds.has(row.applicationId));

  const hired = jobApplications.filter((application) => application.stage === "hired").length;
  const kpis = {
    applicants: jobApplications.length,
    uniqueApplicants: new Set(jobApplications.map((application) => application.applicantProfileId)).size,
    hired,
    activePipeline: jobApplications.filter((application) => !["hired", "rejected", "withdrawn"].includes(application.stage)).length,
    views: job.views,
    applyClicks: job.applyClicks,
    applyRate: job.views ? Math.round((job.applyClicks / job.views) * 100) : 0,
  };

  return NextResponse.json({ job, kpis, applicants: applicantRows });
});

export const PATCH = withApiErrorHandling(async function PATCH(request: Request, props: { params: Promise<{ storeId: string; slug: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "jobs.update");
  const body = await request.json().catch(() => null);
  const status = jobStatuses.includes(body?.status) ? (body.status as JobStatus) : undefined;

  if (getStorageRuntime() === "postgres") {
    const current = await getPostgresJobDetail(params.slug, storeId);
    if (!current || current.job.storeId !== storeId) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    const detail = await updatePostgresStoreJob({
      jobId: current.job.id,
      storeId,
      title: typeof body?.title === "string" ? body.title : undefined,
      location: typeof body?.location === "string" ? body.location : undefined,
      employmentType: typeof body?.employmentType === "string" ? body.employmentType : undefined,
      compensationSummary: typeof body?.compensationSummary === "string" ? body.compensationSummary : undefined,
      description: typeof body?.description === "string" ? body.description : undefined,
      requirements: Array.isArray(body?.requirements) ? body.requirements : undefined,
      idealGemMatchMix: Array.isArray(body?.idealGemMatchMix) ? body.idealGemMatchMix : undefined,
      requiredAssessmentIds: Array.isArray(body?.requiredAssessmentIds) ? body.requiredAssessmentIds : undefined,
      requiredCourseIds: Array.isArray(body?.requiredCourseIds) ? body.requiredCourseIds : undefined,
      status,
    });
    if (!detail) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json({ job: detail.job });
  }

  const updated = updateLocalStoreJob(storeId, params.slug, {
    title: typeof body?.title === "string" ? body.title : undefined,
    locationId: typeof body?.locationId === "string" ? body.locationId : undefined,
    location: typeof body?.location === "string" ? body.location : undefined,
    employmentType: typeof body?.employmentType === "string" ? body.employmentType : undefined,
    compensationSummary: typeof body?.compensationSummary === "string" ? body.compensationSummary : undefined,
    description: typeof body?.description === "string" ? body.description : undefined,
    requirements: Array.isArray(body?.requirements) ? body.requirements : undefined,
    status,
    openings: Number.isFinite(Number(body?.openings)) ? Number(body?.openings) : undefined,
  });
  if (!updated) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ job: updated });
});
