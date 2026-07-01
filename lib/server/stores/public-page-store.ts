import { PublicPageConfig } from "@/lib/public-templates";
import {
  createPublicPagePreview,
  createPublicPageTestimonial,
  deletePublicPageTestimonial,
  getPublishedPublicPage,
  getStorePublicPage,
  listPublicPageReviews,
  listPublicPageTestimonials,
  publishStorePublicPage,
  savePublicPageLogo,
  saveStorePublicPage,
  updatePublicPageReview,
  updatePublicPageTestimonial,
} from "@/lib/local-public-page-store";
import { requireStoreAccess } from "@/lib/server/access-control";
import {
  createPostgresPublicPagePreview,
  createPostgresPublicPageTestimonial,
  deletePostgresPublicPageTestimonial,
  getPostgresPublishedPublicPage,
  getPostgresStorePublicPage,
  listPostgresPublicPageReviews,
  listPostgresPublicPageTestimonials,
  publishPostgresStorePublicPage,
  savePostgresPublicPageLogo,
  savePostgresStorePublicPage,
  updatePostgresPublicPageReview,
  updatePostgresPublicPageTestimonial,
} from "@/lib/server/postgres-phase1";
import { selectStoreAdapter } from "@/lib/server/storage-runtime";

type MaybePromise<T> = T | Promise<T>;
type PublicPageView = Awaited<ReturnType<typeof getStorePublicPage>>;
type PublicPageLogoResult = { asset: Awaited<ReturnType<typeof savePublicPageLogo>>["asset"]; page: PublicPageView };
type PublicPageTestimonialView = PublicPageConfig["testimonials"][number];

export interface SavePublicPageInput {
  storeId: string;
  config: PublicPageConfig;
}

export interface SavePublicPageLogoInput {
  storeId: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  url?: string;
  altText?: string;
}

export interface CreatePublicPageTestimonialInput {
  storeId: string;
  name: string;
  rating?: number;
  text: string;
}

export interface UpdatePublicPageTestimonialInput {
  storeId: string;
  testimonialId: string;
  name?: string;
  rating?: number;
  text?: string;
  status?: "draft" | "published" | "hidden";
}

export interface UpdatePublicPageReviewInput {
  storeId: string;
  reviewId: string;
  status?: "published" | "hidden";
}

export interface PublicPageStore {
  getStorePublicPage(storeId: string): MaybePromise<PublicPageView | undefined>;
  saveStorePublicPage(input: SavePublicPageInput): MaybePromise<PublicPageView | undefined>;
  publishStorePublicPage(input: { storeId: string; status: PublicPageConfig["status"] }): MaybePromise<PublicPageView | undefined>;
  savePublicPageLogo(input: SavePublicPageLogoInput): MaybePromise<PublicPageLogoResult | undefined>;
  getPublishedPublicPage(storeSlug: string): MaybePromise<PublicPageView | undefined>;
  listPublicPageTestimonials(storeId: string): MaybePromise<PublicPageTestimonialView[]>;
  createPublicPageTestimonial(input: CreatePublicPageTestimonialInput): MaybePromise<PublicPageTestimonialView | undefined>;
  updatePublicPageTestimonial(input: UpdatePublicPageTestimonialInput): MaybePromise<PublicPageTestimonialView | undefined>;
  deletePublicPageTestimonial(input: { storeId: string; testimonialId: string }): MaybePromise<PublicPageTestimonialView | undefined>;
  listPublicPageReviews(input: { storeId: string; includeHidden?: boolean }): MaybePromise<ReturnType<typeof listPublicPageReviews>>;
  updatePublicPageReview(input: UpdatePublicPageReviewInput): MaybePromise<ReturnType<typeof updatePublicPageReview>>;
  createPublicPagePreview(storeId: string): MaybePromise<ReturnType<typeof createPublicPagePreview> | undefined>;
}

const localPublicPageStore: PublicPageStore = {
  async getStorePublicPage(storeId) {
    return getStorePublicPage(await requireStoreAccess(storeId, "public_page.read"));
  },
  async saveStorePublicPage(input) {
    await requireStoreAccess(input.storeId, "public_page.update");
    return saveStorePublicPage(input.storeId, input.config);
  },
  async publishStorePublicPage(input) {
    await requireStoreAccess(input.storeId, "public_page.publish");
    return publishStorePublicPage(input.storeId, input.status);
  },
  async savePublicPageLogo(input) {
    await requireStoreAccess(input.storeId, "public_page.logo.save");
    return savePublicPageLogo(input.storeId, {
      filename: input.filename,
      mimeType: input.mimeType,
      size: input.size,
      url: input.url,
      altText: input.altText,
    });
  },
  getPublishedPublicPage,
  async listPublicPageTestimonials(storeId) {
    return listPublicPageTestimonials(await requireStoreAccess(storeId, "public_page.testimonials.list"));
  },
  async createPublicPageTestimonial(input) {
    await requireStoreAccess(input.storeId, "public_page.testimonials.create");
    return createPublicPageTestimonial(input.storeId, {
      name: input.name,
      rating: input.rating,
      text: input.text,
    });
  },
  async updatePublicPageTestimonial(input) {
    await requireStoreAccess(input.storeId, "public_page.testimonials.update");
    return updatePublicPageTestimonial(input.storeId, input.testimonialId, {
      name: input.name,
      rating: input.rating,
      text: input.text,
      status: input.status,
    });
  },
  async deletePublicPageTestimonial(input) {
    await requireStoreAccess(input.storeId, "public_page.testimonials.delete");
    return deletePublicPageTestimonial(input.storeId, input.testimonialId);
  },
  async listPublicPageReviews(input) {
    await requireStoreAccess(input.storeId, "public_page.reviews.list");
    return listPublicPageReviews(input.storeId, input.includeHidden);
  },
  async updatePublicPageReview(input) {
    await requireStoreAccess(input.storeId, "public_page.reviews.update");
    return updatePublicPageReview(input.storeId, input.reviewId, { status: input.status });
  },
  async createPublicPagePreview(storeId) {
    return createPublicPagePreview(await requireStoreAccess(storeId, "public_page.preview.create"));
  },
};

const postgresPublicPageStore: PublicPageStore = {
  async getStorePublicPage(storeId) {
    return getPostgresStorePublicPage(await requireStoreAccess(storeId, "public_page.read"));
  },
  async saveStorePublicPage(input) {
    await requireStoreAccess(input.storeId, "public_page.update");
    return savePostgresStorePublicPage(input);
  },
  async publishStorePublicPage(input) {
    await requireStoreAccess(input.storeId, "public_page.publish");
    return publishPostgresStorePublicPage(input);
  },
  async savePublicPageLogo(input) {
    await requireStoreAccess(input.storeId, "public_page.logo.save");
    return savePostgresPublicPageLogo(input);
  },
  getPublishedPublicPage(storeSlug) {
    return getPostgresPublishedPublicPage(storeSlug);
  },
  async listPublicPageTestimonials(storeId) {
    return listPostgresPublicPageTestimonials(await requireStoreAccess(storeId, "public_page.testimonials.list"));
  },
  async createPublicPageTestimonial(input) {
    await requireStoreAccess(input.storeId, "public_page.testimonials.create");
    return createPostgresPublicPageTestimonial(input);
  },
  async updatePublicPageTestimonial(input) {
    await requireStoreAccess(input.storeId, "public_page.testimonials.update");
    return updatePostgresPublicPageTestimonial(input);
  },
  async deletePublicPageTestimonial(input) {
    await requireStoreAccess(input.storeId, "public_page.testimonials.delete");
    return deletePostgresPublicPageTestimonial(input);
  },
  async listPublicPageReviews(input) {
    await requireStoreAccess(input.storeId, "public_page.reviews.list");
    return listPostgresPublicPageReviews(input);
  },
  async updatePublicPageReview(input) {
    await requireStoreAccess(input.storeId, "public_page.reviews.update");
    return updatePostgresPublicPageReview(input);
  },
  async createPublicPagePreview(storeId) {
    return createPostgresPublicPagePreview(await requireStoreAccess(storeId, "public_page.preview.create"));
  },
};

export function getPublicPageStore(): PublicPageStore {
  return selectStoreAdapter("public-page-store", {
    local: localPublicPageStore,
    postgres: postgresPublicPageStore,
  });
}
