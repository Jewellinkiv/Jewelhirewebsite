import { NextResponse } from "next/server";
import { PUBLIC_JOBS } from "@/lib/applicant-lifecycle";
import { requireStoreAccess } from "@/lib/server/access-control";
import { createPostgresStoreJob, listPostgresStoreJobs } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  if (getStorageRuntime() === "postgres") {
    const storeId = await requireStoreAccess(params.storeId, "jobs.list");
    const items = await listPostgresStoreJobs(storeId);
    return NextResponse.json({ storeId: params.storeId, count: items.length, items });
  }

  const applications = await getApplicantStore().listStoreApplications({ storeId: params.storeId });
  const items = PUBLIC_JOBS.filter((job) => job.storeId === params.storeId).map((job) => {
    const jobApplications = applications.filter((application) => application.jobId === job.id);
    const hired = jobApplications.filter((application) => application.stage === "hired").length;
    return {
      job,
      kpis: {
        applicants: jobApplications.length,
        uniqueApplicants: new Set(jobApplications.map((application) => application.applicantProfileId)).size,
        hired,
        activePipeline: jobApplications.filter((application) => !["hired", "rejected", "withdrawn"].includes(application.stage)).length,
      },
    };
  });

  return NextResponse.json({ storeId: params.storeId, count: items.length, items });
});

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "jobs.create");
  const body = await request.json().catch(() => null);
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
      status: body?.status,
    });
    if (!item) return NextResponse.json({ error: "Job title is required" }, { status: 400 });
    return NextResponse.json({ storeId, item }, { status: 201 });
  }

  return NextResponse.json(
    {
      error: "Local job creation is not wired yet",
      storeId: params.storeId,
      requested: body,
    },
    { status: 501 },
  );
});
