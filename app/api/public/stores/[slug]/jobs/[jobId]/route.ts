import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresPublicStoreSnapshot, incrementPostgresPublicJobView } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { incrementLocalJobView } from "@/lib/local-job-store";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ slug: string; jobId: string }> }) {
  const params = await props.params;
  if (getStorageRuntime() === "postgres") {
    const snapshot = await getPostgresPublicStoreSnapshot(params.slug);
    if (!snapshot) {
      return NextResponse.json({ error: "Public store page not found" }, { status: 404 });
    }

    const job = await incrementPostgresPublicJobView(params.slug, params.jobId);
    if (!job) {
      return NextResponse.json({ error: "Public job not found" }, { status: 404 });
    }

    return NextResponse.json({
      job,
      applyRequirements: {
        requiredAssessmentIds: job.requiredAssessmentIds,
        requiredCourseIds: job.requiredCourseIds,
        idealGemMatchMix: job.idealGemMatchMix,
      },
      privacy: "Phase 1 applications are private to this store.",
      store: snapshot.store,
    });
  }

  const applicantStore = getApplicantStore();
  const page = applicantStore.getPublishedPublicPage(params.slug);

  if (!page) {
    return NextResponse.json({ error: "Public store page not found" }, { status: 404 });
  }

  const job = applicantStore.getPublicJob({ storeSlug: params.slug, jobId: params.jobId });

  if (!job) {
    return NextResponse.json({ error: "Public job not found" }, { status: 404 });
  }
  if (job.storeId) incrementLocalJobView(job.storeId, job.id);

  return NextResponse.json({
    job,
    applyRequirements: {
      requiredAssessmentIds: job.requiredAssessmentIds,
      requiredCourseIds: job.requiredCourseIds,
      idealGemMatchMix: job.idealGemMatchMix,
    },
    privacy: "Phase 1 applications are private to this store.",
  });
});
