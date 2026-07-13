import { NextResponse } from "next/server";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { locationInScope, requestedLocationInScope, requireLocationInScope } from "@/lib/server/location-scope";
import { createLocalStoreJob, listLocalStoreJobs, JobStatus } from "@/lib/local-job-store";
import { createPostgresStoreJob, listPostgresStoreJobs } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { listApplications } from "@/lib/local-api-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

const jobStatuses: JobStatus[] = ["draft", "open", "paused", "closed"];

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const access = await requireLocationScopedStoreAccess(params.storeId, "jobs.list");
  const storeId = access.storeId;
  const url = new URL(request.url);
  const locationId = requestedLocationInScope(url.searchParams.get("locationId"), access.locationIds, "jobs.list");
  if (getStorageRuntime() === "postgres") {
    const items = (await listPostgresStoreJobs(storeId, locationId)).filter((item) =>
      locationInScope(item.job.locationId || item.job.location, access.locationIds),
    );
    return NextResponse.json({ storeId, count: items.length, items });
  }

  const jobs = listLocalStoreJobs(storeId, { locationId }).filter((job) =>
    locationInScope(job.locationId || job.location, access.locationIds),
  );
  const applications = listApplications(storeId);
  const items = jobs.map((job) => {
    const jobApplications = applications.filter((application) => application.jobId === job.id);
    const hired = jobApplications.filter((application) => application.stage === "hired").length;
    return {
      job,
      kpis: {
        applicants: jobApplications.length,
        uniqueApplicants: new Set(jobApplications.map((application) => application.applicantProfileId)).size,
        hired,
        activePipeline: jobApplications.filter((application) => !["hired", "rejected", "withdrawn"].includes(application.stage)).length,
        views: job.views,
        applyClicks: job.applyClicks,
      },
    };
  });

  return NextResponse.json({ storeId, count: items.length, items });
});

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const access = await requireLocationScopedStoreAccess(params.storeId, "jobs.create");
  const storeId = access.storeId;
  const body = await request.json().catch(() => null);
  requireLocationInScope(body?.locationId || body?.location, access.locationIds, "jobs.create");
  const status = jobStatuses.includes(body?.status) ? (body.status as JobStatus) : undefined;

  if (getStorageRuntime() === "postgres") {
    const item = await createPostgresStoreJob({
      storeId,
      title: body?.title,
      location: body?.location,
      employmentType: body?.employmentType,
      compensationSummary: body?.compensationSummary,
      description: body?.description,
      requirements: Array.isArray(body?.requirements) ? body.requirements : undefined,
      idealGemMatchMix: Array.isArray(body?.idealGemMatchMix) ? body.idealGemMatchMix : undefined,
      requiredAssessmentIds: Array.isArray(body?.requiredAssessmentIds) ? body.requiredAssessmentIds : undefined,
      requiredCourseIds: Array.isArray(body?.requiredCourseIds) ? body.requiredCourseIds : undefined,
      status,
    });
    if (!item) return NextResponse.json({ error: "Job title is required" }, { status: 400 });
    return NextResponse.json({ storeId, item }, { status: 201 });
  }

  const result = createLocalStoreJob(storeId, {
    title: body?.title,
    locationId: typeof body?.locationId === "string" ? body.locationId : undefined,
    location: typeof body?.location === "string" ? body.location : undefined,
    employmentType: typeof body?.employmentType === "string" ? body.employmentType : undefined,
    compensationSummary: typeof body?.compensationSummary === "string" ? body.compensationSummary : undefined,
    description: typeof body?.description === "string" ? body.description : undefined,
    requirements: Array.isArray(body?.requirements) ? body.requirements : undefined,
    idealGemMatchMix: Array.isArray(body?.idealGemMatchMix) ? body.idealGemMatchMix : undefined,
    requiredAssessmentIds: Array.isArray(body?.requiredAssessmentIds) ? body.requiredAssessmentIds : undefined,
    requiredCourseIds: Array.isArray(body?.requiredCourseIds) ? body.requiredCourseIds : undefined,
    status,
    openings: Number(body?.openings),
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ storeId, item: result }, { status: 201 });
});
