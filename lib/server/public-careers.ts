// Runtime-agnostic snapshot for the PUBLIC careers pages (/careers/[slug]).
// Mirrors what /api/public/stores/[slug] serves, but callable directly from
// server components so the careers page is fully server-rendered — it's the
// hyperlink store owners embed on their own sites, so it must render real data
// with no client fetch and no session.
import { StorePublicPageRecord } from "@/lib/applicant-lifecycle";
import { getPreviewPublicPage, getPublishedPublicPage } from "@/lib/local-public-page-store";
import { PublicPageConfig } from "@/lib/public-templates";
import { getPostgresPreviewPublicPage, getPostgresPublishedPublicPage, listPostgresStoreLocations } from "@/lib/server/postgres-phase1";
import { verifyPublicPreviewToken } from "@/lib/server/public-preview-token";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { listStoreLocations } from "@/lib/local-team-store";
import type { JobLocationScope } from "@/lib/job-location-targeting";

export interface PublicCareersJob {
  id: string;
  title: string;
  location?: string;
  locationScope?: JobLocationScope;
  locationIds?: string[];
  employmentType?: string;
  type?: string;
  compensationSummary?: string;
  salary?: string;
  description?: string;
  blurb?: string;
  requirements?: string[];
  openedAt?: string;
}

export interface PublicCareersSnapshot {
  store: { id: string; name: string; slug: string; locationLabel?: string; rating?: number; reviewCount?: number };
  locations: Array<{ id: string; name: string }>;
  page: StorePublicPageRecord;
  jobs: PublicCareersJob[];
  config: PublicPageConfig;
  isPreview: boolean;
}

export async function getPublicCareersSnapshot(slug: string, previewToken?: string): Promise<PublicCareersSnapshot | undefined> {
  const preview = previewToken ? verifyPublicPreviewToken(previewToken, slug) : undefined;
  if (previewToken && !preview) return undefined;
  const view = getStorageRuntime() === "postgres"
    ? preview ? await getPostgresPreviewPublicPage(slug) : await getPostgresPublishedPublicPage(slug)
    : preview ? getPreviewPublicPage(slug) : getPublishedPublicPage(slug);
  if (!view) return undefined;
  if (preview && preview.storeId !== view.page.storeId) return undefined;
  const locations = getStorageRuntime() === "postgres"
    ? await listPostgresStoreLocations(view.page.storeId)
    : listStoreLocations(view.page.storeId);
  return {
    store: {
      id: view.page.storeId,
      name: view.store.name,
      slug: view.page.slug,
      locationLabel: view.store.location,
      rating: view.store.rating,
      reviewCount: view.store.reviewCount,
    },
    page: view.page,
    jobs: view.jobs,
    locations: locations.map((location) => ({ id: location.id, name: location.name })),
    config: view.config,
    isPreview: Boolean(preview),
  };
}
