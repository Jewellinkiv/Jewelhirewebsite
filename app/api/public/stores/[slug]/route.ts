import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresPublicStoreSnapshot } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  if (getStorageRuntime() === "postgres") {
    const snapshot = await getPostgresPublicStoreSnapshot(params.slug);
    if (!snapshot) {
      return NextResponse.json({ error: "Public store page not found" }, { status: 404 });
    }
    return NextResponse.json({
      page: snapshot.publicPage,
      jobs: snapshot.jobs,
      store: snapshot.store,
    });
  }

  const applicantStore = getApplicantStore();
  const page = applicantStore.getPublishedPublicPage(params.slug);

  if (!page) {
    return NextResponse.json({ error: "Public store page not found" }, { status: 404 });
  }

  return NextResponse.json({
    page,
    jobs: applicantStore.getOpenJobsForStore(page.storeId),
  });
});
