// Runtime-agnostic snapshot for the PUBLIC careers pages (/careers/[slug]).
// Mirrors what /api/public/stores/[slug] serves, but callable directly from
// server components so the careers page is fully server-rendered — it's the
// hyperlink store owners embed on their own sites, so it must render real data
// with no client fetch and no session.
import { PublicJobRecord, StorePublicPageRecord } from "@/lib/applicant-lifecycle";
import { getStoreSettings } from "@/lib/local-settings-store";
import { getPostgresPublicStoreSnapshot } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export interface PublicCareersSnapshot {
  store: { id: string; name: string; slug: string; locationLabel?: string };
  page: StorePublicPageRecord;
  jobs: PublicJobRecord[];
}

export async function getPublicCareersSnapshot(slug: string): Promise<PublicCareersSnapshot | undefined> {
  if (getStorageRuntime() === "postgres") {
    const snapshot = await getPostgresPublicStoreSnapshot(slug);
    if (!snapshot) return undefined;
    return { store: snapshot.store, page: snapshot.publicPage, jobs: snapshot.jobs };
  }

  const applicantStore = getApplicantStore();
  const page = applicantStore.getPublishedPublicPage(slug);
  if (!page) return undefined;
  const company = getStoreSettings(page.storeId).organization.company?.trim();
  return {
    store: { id: page.storeId, name: company || page.headline, slug: page.slug },
    page,
    jobs: applicantStore.getOpenJobsForStore(page.storeId),
  };
}
