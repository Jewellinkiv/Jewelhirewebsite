import { NextResponse } from "next/server";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { getLocalStoreJob, updateLocalStoreJob, JobStatus } from "@/lib/local-job-store";
import { getPostgresJobDetail, listPostgresStoreLocations, updatePostgresStoreJob } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { listStoreLocations } from "@/lib/local-team-store";
import { applicationIntersectsLocationScope, jobFitsLocationScope, jobIntersectsLocationScope, normalizeJobLocationTargeting } from "@/lib/job-location-targeting";

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
  const access = await requireLocationScopedStoreAccess(params.storeId, "jobs.read");
  const storeId = access.storeId;

  if (getStorageRuntime() === "postgres") {
    const detail = await getPostgresJobDetail(params.slug, storeId);
    if (!detail || detail.job.storeId !== storeId) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (!jobIntersectsLocationScope(detail.job, access.locationIds)) return NextResponse.json({ error: "Location is not in scope for jobs.read" }, { status: 403 });
    const visibleApplicants = detail.applicants.filter((item) => applicationIntersectsLocationScope(item.application, detail.job, access.locationIds));
    const applicants = visibleApplicants.map((item) => ({
      applicationId: item.application.id,
      name: item.applicant.fullName,
      initials: initials(item.applicant.fullName),
      stage: item.application.stage,
      appliedDate: item.application.submittedAt || item.application.createdAt,
      preferredLocationScope: item.application.preferredLocationScope,
      preferredLocationIds: item.application.preferredLocationIds || [],
    }));
    const views = "views" in detail.job && typeof detail.job.views === "number" ? detail.job.views : 0;
    const applyClicks = "applyClicks" in detail.job && typeof detail.job.applyClicks === "number" ? detail.job.applyClicks : 0;
    return NextResponse.json({
      job: detail.job,
      kpis: {
        applicants: access.locationIds ? visibleApplicants.length : detail.kpis.total,
        uniqueApplicants: access.locationIds ? new Set(visibleApplicants.map((item) => item.application.applicantProfileId)).size : detail.kpis.unique,
        hired: access.locationIds ? visibleApplicants.filter((item) => item.application.stage === "hired").length : detail.kpis.hired,
        activePipeline: access.locationIds ? visibleApplicants.filter((item) => !["hired", "rejected", "withdrawn"].includes(item.application.stage)).length : detail.kpis.activePipeline,
        views,
        applyClicks,
        applyRate: views ? Math.round((applyClicks / views) * 100) : 0,
      },
      applicants,
    });
  }

  const job = getLocalStoreJob(storeId, params.slug);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!jobIntersectsLocationScope(job, access.locationIds)) return NextResponse.json({ error: "Location is not in scope for jobs.read" }, { status: 403 });

  const applications = await getApplicantStore().listStoreApplications({ storeId });
  const jobApplications = applications.filter((application) => application.jobId === job.id && applicationIntersectsLocationScope(application, job, access.locationIds));
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

  return NextResponse.json({
    job,
    kpis,
    applicants: applicantRows.map((row) => {
      const application = jobApplications.find((item) => item.id === row.applicationId);
      return {
        ...row,
        preferredLocationScope: application?.preferredLocationScope,
        preferredLocationIds: application?.preferredLocationIds || [],
      };
    }),
  });
});

export const PATCH = withApiErrorHandling(async function PATCH(request: Request, props: { params: Promise<{ storeId: string; slug: string }> }) {
  const params = await props.params;
  const access = await requireLocationScopedStoreAccess(params.storeId, "jobs.update");
  const storeId = access.storeId;
  const body = await request.json().catch(() => null);
  const status = jobStatuses.includes(body?.status) ? (body.status as JobStatus) : undefined;
  const updatesTargeting = body?.locationScope !== undefined || body?.locationIds !== undefined || body?.locationId !== undefined;
  const locations = updatesTargeting
    ? (getStorageRuntime() === "postgres" ? await listPostgresStoreLocations(storeId) : listStoreLocations(storeId))
    : [];
  const targeting = updatesTargeting ? normalizeJobLocationTargeting(body || {}, locations) : undefined;
  if (targeting && "error" in targeting) return NextResponse.json({ error: targeting.error }, { status: 400 });
  if (targeting && !jobFitsLocationScope({ locationScope: targeting.locationScope, locationIds: targeting.locationIds }, access.locationIds)) {
    return NextResponse.json({ error: "Selected store locations are not in scope for this user." }, { status: 403 });
  }

  if (getStorageRuntime() === "postgres") {
    const current = await getPostgresJobDetail(params.slug, storeId);
    if (!current || current.job.storeId !== storeId) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (!jobIntersectsLocationScope(current.job, access.locationIds)) return NextResponse.json({ error: "Location is not in scope for jobs.update" }, { status: 403 });
    const detail = await updatePostgresStoreJob({
      jobId: current.job.id,
      storeId,
      title: typeof body?.title === "string" ? body.title : undefined,
      location: targeting && !('error' in targeting) ? targeting.location : typeof body?.location === "string" ? body.location : undefined,
      locationScope: targeting && !('error' in targeting) ? targeting.locationScope : undefined,
      locationIds: targeting && !('error' in targeting) ? targeting.locationIds : undefined,
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

  const current = getLocalStoreJob(storeId, params.slug);
  if (!current) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!jobIntersectsLocationScope(current, access.locationIds)) return NextResponse.json({ error: "Location is not in scope for jobs.update" }, { status: 403 });
  const updated = updateLocalStoreJob(storeId, params.slug, {
    title: typeof body?.title === "string" ? body.title : undefined,
    locationId: targeting && !('error' in targeting) ? targeting.locationIds[0] : typeof body?.locationId === "string" ? body.locationId : undefined,
    location: targeting && !('error' in targeting) ? targeting.location : typeof body?.location === "string" ? body.location : undefined,
    locationScope: targeting && !('error' in targeting) ? targeting.locationScope : undefined,
    locationIds: targeting && !('error' in targeting) ? targeting.locationIds : undefined,
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
