// In-memory job store for the local (Phase-1) runtime. It hydrates from the
// launch seed roles, then keeps store-owner edits and new roles in memory.

import { PUBLIC_JOBS } from "@/lib/applicant-lifecycle";
import { JOB_POSTINGS, JobPosting } from "@/lib/job-postings";

export type JobStatus = "draft" | "open" | "paused" | "closed";

export interface JobRecord {
  id: string;
  slug: string;
  storeId: string;
  title: string;
  locationId: string | null;
  location: string;
  employmentType: string;
  compensationSummary: string;
  description: string;
  requirements: string[];
  idealGemMatchMix: string[];
  requiredAssessmentIds: string[];
  requiredCourseIds: string[];
  status: JobStatus;
  openings: number;
  views: number;
  applyClicks: number;
  createdAt: string;
  updatedAt: string;
}

interface JobState {
  jobsByStoreId: Record<string, JobRecord[]>;
  seededStoreIds: Record<string, true>;
}

declare global {
  // eslint-disable-next-line no-var
  var __jewelhireJobStore: JobState | undefined;
}

function state(): JobState {
  if (!globalThis.__jewelhireJobStore) {
    globalThis.__jewelhireJobStore = { jobsByStoreId: {}, seededStoreIds: {} };
  }
  globalThis.__jewelhireJobStore.seededStoreIds ??= {};
  return globalThis.__jewelhireJobStore;
}

function bucket(storeId: string): JobRecord[] {
  const storeState = state();
  storeState.jobsByStoreId[storeId] ??= [];
  if (!storeState.seededStoreIds[storeId]) {
    seedStoreJobs(storeId, storeState.jobsByStoreId[storeId]);
    storeState.seededStoreIds[storeId] = true;
  }
  return storeState.jobsByStoreId[storeId];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function uniqueSlug(storeId: string, title: string) {
  const base = slugify(title) || "role";
  const existing = new Set(bucket(storeId).map((job) => job.slug));
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function nowIso() {
  return new Date().toISOString();
}

function locationIdFor(location: string) {
  const normalized = location.toLowerCase();
  if (normalized.includes("little rock")) return "little-rock";
  if (normalized.includes("memphis")) return "memphis";
  if (normalized.includes("jonesboro")) return "jonesboro";
  return null;
}

function createdAtFor(posting: JobPosting, openedAt?: string) {
  if (openedAt) return openedAt;
  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - posting.postedDaysAgo);
  return createdAt.toISOString();
}

function statusFor(posting: JobPosting, publicStatus?: JobStatus): JobStatus {
  if (publicStatus) return publicStatus;
  if (posting.status === "Active") return "open";
  return posting.status.toLowerCase() as JobStatus;
}

function findPublicJob(posting: JobPosting) {
  const postingTitle = posting.title.toLowerCase();
  return PUBLIC_JOBS.find((job) => job.title.toLowerCase().includes(postingTitle) || postingTitle.includes(job.title.toLowerCase()));
}

function seedStoreJobs(storeId: string, jobs: JobRecord[]) {
  const existing = new Set(jobs.flatMap((job) => [job.id, job.slug]));
  for (const posting of JOB_POSTINGS) {
    const publicJob = findPublicJob(posting);
    if (publicJob && publicJob.storeId !== storeId) continue;
    const id = publicJob?.id || `job-${posting.slug}`;
    if (existing.has(id) || existing.has(posting.slug)) continue;
    const location = publicJob?.location || posting.location;
    jobs.push({
      id,
      slug: posting.slug,
      storeId,
      title: publicJob?.title || posting.title,
      locationId: locationIdFor(location),
      location,
      employmentType: publicJob?.employmentType || "Full-time",
      compensationSummary: publicJob?.compensationSummary || "",
      description: publicJob?.description || "",
      requirements: publicJob?.requirements || [],
      idealGemMatchMix: publicJob?.idealGemMatchMix || [],
      requiredAssessmentIds: publicJob?.requiredAssessmentIds || [],
      requiredCourseIds: publicJob?.requiredCourseIds || [],
      status: statusFor(posting, publicJob?.status),
      openings: posting.openings,
      views: posting.views,
      applyClicks: 0,
      createdAt: createdAtFor(posting, publicJob?.openedAt),
      updatedAt: publicJob?.openedAt || createdAtFor(posting),
    });
  }
}

function clone(job: JobRecord): JobRecord {
  return { ...job, requirements: [...job.requirements], idealGemMatchMix: [...job.idealGemMatchMix], requiredAssessmentIds: [...job.requiredAssessmentIds], requiredCourseIds: [...job.requiredCourseIds] };
}

export function listLocalStoreJobs(storeId: string, opts: { locationId?: string | null; status?: JobStatus | null } = {}) {
  return bucket(storeId)
    .filter((job) => !opts.locationId || job.locationId === opts.locationId)
    .filter((job) => !opts.status || job.status === opts.status)
    .map(clone);
}

export function listPublicLocalStoreJobs(storeId: string, locationId?: string | null) {
  return listLocalStoreJobs(storeId, { locationId, status: "open" });
}

export function getLocalStoreJob(storeId: string, slugOrId: string) {
  const job = bucket(storeId).find((item) => item.slug === slugOrId || item.id === slugOrId);
  return job ? clone(job) : undefined;
}

export interface CreateLocalJobInput {
  title: string;
  locationId?: string | null;
  location?: string;
  employmentType?: string;
  compensationSummary?: string;
  description?: string;
  requirements?: string[];
  idealGemMatchMix?: string[];
  requiredAssessmentIds?: string[];
  requiredCourseIds?: string[];
  status?: JobStatus;
  openings?: number;
}

export function createLocalStoreJob(storeId: string, input: CreateLocalJobInput): JobRecord | { error: string } {
  const title = (input.title || "").trim();
  if (!title) return { error: "Job title is required" };
  const slug = uniqueSlug(storeId, title);
  const timestamp = nowIso();
  const job: JobRecord = {
    id: `job-${storeId}-${slug}`,
    slug,
    storeId,
    title,
    locationId: input.locationId || null,
    location: (input.location || "").trim() || "Little Rock",
    employmentType: (input.employmentType || "").trim() || "Full-time",
    compensationSummary: (input.compensationSummary || "").trim(),
    description: (input.description || "").trim(),
    requirements: (input.requirements || []).map((r) => r.trim()).filter(Boolean),
    idealGemMatchMix: input.idealGemMatchMix || [],
    requiredAssessmentIds: input.requiredAssessmentIds || [],
    requiredCourseIds: input.requiredCourseIds || [],
    status: input.status || "open",
    openings: Number.isFinite(input.openings) && (input.openings as number) > 0 ? Math.floor(input.openings as number) : 1,
    views: 0,
    applyClicks: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  bucket(storeId).unshift(job);
  return clone(job);
}

export function updateLocalStoreJob(storeId: string, slugOrId: string, patch: Partial<CreateLocalJobInput>): JobRecord | undefined {
  const job = bucket(storeId).find((item) => item.slug === slugOrId || item.id === slugOrId);
  if (!job) return undefined;
  if (typeof patch.title === "string" && patch.title.trim()) job.title = patch.title.trim();
  if (patch.locationId !== undefined) job.locationId = patch.locationId || null;
  if (typeof patch.location === "string" && patch.location.trim()) job.location = patch.location.trim();
  if (typeof patch.employmentType === "string" && patch.employmentType.trim()) job.employmentType = patch.employmentType.trim();
  if (typeof patch.compensationSummary === "string") job.compensationSummary = patch.compensationSummary.trim();
  if (typeof patch.description === "string") job.description = patch.description.trim();
  if (Array.isArray(patch.requirements)) job.requirements = patch.requirements.map((r) => r.trim()).filter(Boolean);
  if (Array.isArray(patch.idealGemMatchMix)) job.idealGemMatchMix = patch.idealGemMatchMix;
  if (Array.isArray(patch.requiredAssessmentIds)) job.requiredAssessmentIds = patch.requiredAssessmentIds;
  if (Array.isArray(patch.requiredCourseIds)) job.requiredCourseIds = patch.requiredCourseIds;
  if (patch.status) job.status = patch.status;
  if (Number.isFinite(patch.openings) && (patch.openings as number) > 0) job.openings = Math.floor(patch.openings as number);
  job.updatedAt = nowIso();
  return clone(job);
}

export function setLocalStoreJobStatus(storeId: string, slugOrId: string, status: JobStatus) {
  return updateLocalStoreJob(storeId, slugOrId, { status });
}

export function incrementLocalJobView(storeId: string, slugOrId: string) {
  const job = bucket(storeId).find((item) => item.slug === slugOrId || item.id === slugOrId);
  if (!job) return undefined;
  job.views += 1;
  return clone(job);
}

export function incrementLocalJobApplyClick(storeId: string, slugOrId: string) {
  const job = bucket(storeId).find((item) => item.slug === slugOrId || item.id === slugOrId);
  if (!job) return undefined;
  job.applyClicks += 1;
  return clone(job);
}
