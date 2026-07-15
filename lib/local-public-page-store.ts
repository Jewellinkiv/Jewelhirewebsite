import { DEFAULT_HOURS, DEFAULT_TESTIMONIALS, PublicPageConfig, TEMPLATES } from "./public-templates";
import { STORE, STORE_REVIEWS, type PublicJob } from "./public-store";
import { getOpenJobsForStore, STORE_PUBLIC_PAGES } from "./applicant-lifecycle";

export interface PublicPageAsset {
  id: string;
  storeId: string;
  usageContext: "logo" | "hero" | "gallery";
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  storageUrl: string;
  altText: string;
  source: "local_placeholder" | "uploaded" | "external_url";
  createdAt: string;
  updatedAt: string;
}

export interface PublicPageReview {
  id: string;
  name: string;
  rating: number;
  text: string;
  when: string;
  source: "store_seed" | "google" | "manual";
  status: "published" | "hidden";
  createdAt: string;
  updatedAt: string;
}

export interface PublicPagePreview {
  id: string;
  storeId: string;
  generatedAt: string;
  status: PublicPageConfig["status"];
  previewUrl: string;
  snapshot: {
    logoText: string;
    logoUrl?: string;
    headline: string;
    testimonialCount: number;
    reviewCount: number;
    jobCount: number;
  };
}

interface PublicPageState {
  configsByStoreId: Record<string, PublicPageConfig>;
  assetsByStoreId: Record<string, PublicPageAsset[]>;
  reviewsByStoreId: Record<string, PublicPageReview[]>;
  previewsByStoreId: Record<string, PublicPagePreview[]>;
}

declare global {
  var __jewelhirePublicPageStore: PublicPageState | undefined;
}

function state(): PublicPageState {
  if (!globalThis.__jewelhirePublicPageStore) {
    globalThis.__jewelhirePublicPageStore = {
      configsByStoreId: {},
      assetsByStoreId: {},
      reviewsByStoreId: {},
      previewsByStoreId: {},
    };
  }
  return globalThis.__jewelhirePublicPageStore;
}

function nowIso() {
  return new Date().toISOString();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function id(prefix: string, seed: string) {
  return `${prefix}-${slugify(seed) || "record"}-${Date.now().toString(36)}`;
}

function testimonialId(name: string, index: number) {
  return `testimonial-${slugify(name) || index + 1}`;
}

function normalizeTestimonials(testimonials: PublicPageConfig["testimonials"]) {
  const timestamp = nowIso();
  return testimonials.map((testimonial, index) => ({
    id: testimonial.id || testimonialId(testimonial.name, index),
    name: testimonial.name,
    rating: Math.max(1, Math.min(5, Math.round(Number(testimonial.rating) || 5))),
    text: testimonial.text,
    source: testimonial.source || "manual",
    status: testimonial.status || "published",
    createdAt: testimonial.createdAt || timestamp,
    updatedAt: timestamp,
  }));
}

function ensureReviews(storeId: string) {
  state().reviewsByStoreId[storeId] ??= STORE_REVIEWS.map((review, index) => ({
    id: `review-${slugify(review.name)}-${index + 1}`,
    ...review,
    source: "store_seed",
    status: "published",
    createdAt: "2026-06-01T14:00:00.000Z",
    updatedAt: "2026-06-01T14:00:00.000Z",
  }));
  return state().reviewsByStoreId[storeId];
}

function ensureAssets(storeId: string) {
  state().assetsByStoreId[storeId] ??= [];
  return state().assetsByStoreId[storeId];
}

function ensurePreviews(storeId: string) {
  state().previewsByStoreId[storeId] ??= [];
  return state().previewsByStoreId[storeId];
}

function publicJobs(storeId: string): PublicJob[] {
  return getOpenJobsForStore(storeId).map((job) => ({
    id: job.id,
    title: job.title,
    type: job.employmentType,
    location: job.location,
    salary: job.compensationSummary,
    blurb: job.description,
  }));
}

function defaultConfig(storeId: string): PublicPageConfig {
  const template = TEMPLATES[0];
  const seededPage = STORE_PUBLIC_PAGES.find((page) => page.storeId === storeId);
  return {
    templateId: template.id,
    logoText: STORE.name,
    theme: { ...template.theme },
    jobLayout: template.jobLayout,
    headline: "Build a career in fine jewelry.",
    about: STORE.about,
    hours: DEFAULT_HOURS.map((hour) => ({ ...hour })),
    showReviews: true,
    testimonials: normalizeTestimonials(DEFAULT_TESTIMONIALS),
    status: seededPage?.status || "draft",
  };
}

function cloneConfig(config: PublicPageConfig): PublicPageConfig {
  return {
    ...config,
    theme: { ...config.theme },
    hours: config.hours.map((hour) => ({ ...hour })),
    testimonials: config.testimonials.map((testimonial) => ({ ...testimonial })),
  };
}

function ensureConfig(storeId: string) {
  state().configsByStoreId[storeId] ??= defaultConfig(storeId);
  return state().configsByStoreId[storeId];
}

export function getStorePublicPage(storeId: string) {
  const config = cloneConfig(ensureConfig(storeId));
  const assets = ensureAssets(storeId).map((asset) => ({ ...asset }));
  const reviews = ensureReviews(storeId).map((review) => ({ ...review }));
  const previews = ensurePreviews(storeId).map((preview) => structuredClone(preview));
  const page = STORE_PUBLIC_PAGES.find((item) => item.storeId === storeId) || STORE_PUBLIC_PAGES[0];
  return {
    page,
    store: STORE,
    jobs: publicJobs(storeId),
    config,
    assets,
    logoAsset: assets.find((asset) => asset.id === config.logoAssetId || asset.usageContext === "logo") || null,
    reviews,
    previews,
  };
}

export function saveStorePublicPage(storeId: string, config: PublicPageConfig) {
  state().configsByStoreId[storeId] = cloneConfig({
    ...config,
    testimonials: normalizeTestimonials(config.testimonials || []),
  });
  return getStorePublicPage(storeId);
}

export function publishStorePublicPage(storeId: string, status: PublicPageConfig["status"]) {
  const current = ensureConfig(storeId);
  current.status = status;
  return getStorePublicPage(storeId);
}

export function savePublicPageLogo(
  storeId: string,
  input: { filename?: string; mimeType?: string; size?: number; url?: string; altText?: string },
) {
  const timestamp = nowIso();
  const filename = input.filename?.trim() || `${slugify(STORE.name)}-logo.png`;
  const asset: PublicPageAsset = {
    id: id("public-page-logo", filename),
    storeId,
    usageContext: "logo",
    originalFilename: filename,
    mimeType: input.mimeType || "image/png",
    fileSizeBytes: Number.isFinite(input.size) ? Number(input.size) : 0,
    storageUrl: input.url || `/mock-assets/${storeId}/${filename}`,
    altText: input.altText || `${STORE.name} logo`,
    source: input.url ? "external_url" : "local_placeholder",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const assets = ensureAssets(storeId).filter((item) => item.usageContext !== "logo");
  assets.unshift(asset);
  state().assetsByStoreId[storeId] = assets;
  const config = ensureConfig(storeId);
  config.logoUrl = asset.storageUrl;
  config.logoAssetId = asset.id;
  return { asset, page: getStorePublicPage(storeId) };
}

export function listPublicPageTestimonials(storeId: string) {
  return cloneConfig(ensureConfig(storeId)).testimonials;
}

export function createPublicPageTestimonial(storeId: string, input: { name: string; rating?: number; text: string }) {
  const config = ensureConfig(storeId);
  const timestamp = nowIso();
  const testimonial = {
    id: id("testimonial", input.name || "customer"),
    name: input.name.trim(),
    rating: Math.max(1, Math.min(5, Math.round(Number(input.rating) || 5))),
    text: input.text.trim(),
    source: "manual" as const,
    status: "published" as const,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  config.testimonials.unshift(testimonial);
  return testimonial;
}

export function updatePublicPageTestimonial(
  storeId: string,
  testimonialId: string,
  input: { name?: string; rating?: number; text?: string; status?: "draft" | "published" | "hidden" },
) {
  const config = ensureConfig(storeId);
  const testimonial = config.testimonials.find((item) => item.id === testimonialId);
  if (!testimonial) return undefined;
  if (input.name !== undefined) testimonial.name = input.name.trim();
  if (input.rating !== undefined) testimonial.rating = Math.max(1, Math.min(5, Math.round(Number(input.rating) || testimonial.rating)));
  if (input.text !== undefined) testimonial.text = input.text.trim();
  if (input.status !== undefined) testimonial.status = input.status;
  testimonial.updatedAt = nowIso();
  return testimonial;
}

export function deletePublicPageTestimonial(storeId: string, testimonialId: string) {
  const config = ensureConfig(storeId);
  const testimonial = config.testimonials.find((item) => item.id === testimonialId);
  if (!testimonial) return undefined;
  config.testimonials = config.testimonials.filter((item) => item.id !== testimonialId);
  return testimonial;
}

export function listPublicPageReviews(storeId: string, includeHidden = false) {
  return ensureReviews(storeId)
    .filter((review) => includeHidden || review.status === "published")
    .map((review) => ({ ...review }));
}

export function updatePublicPageReview(storeId: string, reviewId: string, input: { status?: "published" | "hidden" }) {
  const review = ensureReviews(storeId).find((item) => item.id === reviewId);
  if (!review) return undefined;
  if (input.status) review.status = input.status;
  review.updatedAt = nowIso();
  return { ...review };
}

export function createPublicPagePreview(storeId: string) {
  const config = ensureConfig(storeId);
  const timestamp = nowIso();
  const preview: PublicPagePreview = {
    id: id("public-page-preview", storeId),
    storeId,
    generatedAt: timestamp,
    status: config.status,
    previewUrl: `/api/public/${slugify(STORE.name)}?preview=${Date.now().toString(36)}`,
    snapshot: {
      logoText: config.logoText,
      logoUrl: config.logoUrl,
      headline: config.headline,
      testimonialCount: config.testimonials.filter((testimonial) => testimonial.status !== "hidden").length,
      reviewCount: listPublicPageReviews(storeId).length,
      jobCount: publicJobs(storeId).length,
    },
  };
  ensurePreviews(storeId).unshift(preview);
  state().previewsByStoreId[storeId] = ensurePreviews(storeId).slice(0, 10);
  return preview;
}

export function getPublishedPublicPage(storeSlug: string) {
  const publicPage = STORE_PUBLIC_PAGES.find((item) => item.slug === storeSlug);
  if (!publicPage) return undefined;
  const config = ensureConfig(publicPage.storeId);
  if (config.status !== "published") return undefined;
  const page = getStorePublicPage(publicPage.storeId);
  return {
    ...page,
    reviews: listPublicPageReviews(publicPage.storeId),
  };
}

export function getPreviewPublicPage(storeSlug: string) {
  const publicPage = STORE_PUBLIC_PAGES.find((item) => item.slug === storeSlug);
  if (!publicPage) return undefined;
  return getStorePublicPage(publicPage.storeId);
}
