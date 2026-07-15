import { randomUUID } from "node:crypto";
import {
  ApplicantNoteRecord,
  ApplicantProfileRecord,
  ApplicantResumeRecord,
  ApplicationAttachmentRecord,
  ApplicationDetail,
  ApplicationRecord,
  ApplicationStage,
  ApplicationStageEventRecord,
  GemMatchInviteRecord,
  HireToJewelLinkSyncRecord,
  InterviewLocationType,
  InterviewRecord,
  JewelCertInviteRecord,
  PublicJobRecord,
  StorePublicPageRecord,
} from "@/lib/applicant-lifecycle";
import type { AssessmentResult } from "@/lib/assessment-results";
import { floorRead } from "@/lib/dashboard";
import { CalProvider, INVITE_SETTINGS, InviteSettings, PROVIDER_LABEL } from "@/lib/invite-settings";
import { CERT_COMPONENTS, CERT_COURSES } from "@/lib/jewelcert";
import { getPostgresCourseTitles } from "@/lib/server/postgres-courses";
import { fitFor, Mix, PROFILE_ORDER, ProfileCode, PROFILES, TYPE_BY_PAIR } from "@/lib/gemmatch";
import { ADJECTIVES, score as scoreGemMatch } from "@/lib/server/gemmatch-scoring";
import type { AssessmentKind, AssessmentQuestion, CustomAssessment } from "@/lib/custom-assessments";
import type {
  CourseCompletionTest,
  CourseTestAnswer,
  CourseTestAttempt,
  CourseTestQuestion,
  CourseTestStatus,
} from "@/lib/local-course-test-store";
import type { CourseAssignmentRecord } from "@/lib/local-api-store";
import { DEFAULT_HOURS, DEFAULT_TESTIMONIALS, PublicPageConfig } from "@/lib/public-templates";
import { STORE } from "@/lib/public-store";
import type { PublicJob } from "@/lib/public-store";
import { Course, courseStats, getCourse } from "@/lib/training-center";
import { ManagerUser, UserRole } from "@/lib/users";
import type { PublicPageAsset, PublicPagePreview, PublicPageReview } from "@/lib/local-public-page-store";
import type { NotificationRule, StoreIntegration, StoreSettingsRecord } from "@/lib/local-settings-store";
import type { AdminAuditEntry } from "@/lib/local-admin-store";
import { AdminCompany, AdminCompanyUser, CompanyStatus, INVOICES, PLANS, PlanTier } from "@/lib/admin";
import type { PoolClient } from "pg";
import { getPostgresPool } from "@/lib/server/postgres";

const PROTECTED_ADMIN_COMPANY_IDS = new Set(["co-sissys", "co-harbor", "co-sterling", "co-northpoint"]);

type JsonArray = unknown[] | null;

interface PublicStoreRow {
  page_id: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  location_label: string | null;
  page_slug: string;
  headline: string;
  about: string | null;
  benefits: JsonArray;
  review_summary: { rating?: number; count?: number } | null;
  status: StorePublicPageRecord["status"];
  published_at: string | null;
  updated_at: string;
}

interface PublicJobRow {
  id: string;
  store_id: string;
  public_page_id: string;
  slug?: string | null;
  title: string;
  location: string | null;
  employment_type: string | null;
  compensation_summary: string | null;
  description: string | null;
  requirements: JsonArray;
  ideal_gemmatch_mix: JsonArray;
  required_assessment_ids: JsonArray;
  required_course_ids: JsonArray;
  status: PublicJobRecord["status"];
  opened_at: string | null;
  closed_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  view_count?: number | null;
  apply_click_count?: number | null;
}

interface ApplicationSummaryRow {
  total_count: string;
  application_id: string;
  store_id: string;
  store_name: string | null;
  job_id: string | null;
  applicant_profile_id: string;
  source: ApplicationRecord["source"];
  stage: ApplicationStage;
  status_reason: string | null;
  current_owner_user_id: string | null;
  submitted_at: string;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  applicant_full_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  applicant_location: string | null;
  applicant_resume_headline: string | null;
  applicant_summary: string | null;
  applicant_visibility: ApplicantProfileRecord["visibility"];
  applicant_created_at: string;
  applicant_updated_at: string;
  job_title: string | null;
  job_location: string | null;
  jewelcert_status: string | null;
  gemmatch_status: string | null;
  gemmatch_profile: string | null;
  gemmatch_fit: string | null;
  gemmatch_fit_score: number | null;
  interview_status: string | null;
  next_interview_at: string | null;
  note_count: string;
}

interface ApplicationDetailRow {
  application_id: string;
  store_id: string;
  job_id: string | null;
  applicant_profile_id: string;
  source: ApplicationRecord["source"];
  stage: ApplicationStage;
  status_reason: string | null;
  current_owner_user_id: string | null;
  submitted_at: string;
  last_activity_at: string;
  application_created_at: string;
  application_updated_at: string;
  applicant_full_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  applicant_location: string | null;
  applicant_resume_headline: string | null;
  applicant_summary: string | null;
  applicant_visibility: ApplicantProfileRecord["visibility"];
  applicant_created_at: string;
  applicant_updated_at: string;
  resume_id: string | null;
  resume_summary: string | null;
  work_experience: JsonArray;
  education: JsonArray;
  skills: JsonArray;
  portfolio_links: JsonArray;
  course_credential_ids: JsonArray;
  resume_updated_at: string | null;
  public_page_id: string | null;
  job_title: string | null;
  job_location: string | null;
  employment_type: string | null;
  compensation_summary: string | null;
  job_description: string | null;
  requirements: JsonArray;
  ideal_gemmatch_mix: JsonArray;
  required_assessment_ids: JsonArray;
  required_course_ids: JsonArray;
  job_status: PublicJobRecord["status"] | null;
  opened_at: string | null;
  closed_at: string | null;
}

interface ApplicationAttachmentRow {
  id: string;
  application_id: string;
  store_id: string;
  kind: "resume";
  original_filename: string;
  mime_type: ApplicationAttachmentRecord["mimeType"];
  file_size_bytes: number;
  sha256: string;
  content?: Buffer;
  created_at: string;
}

interface StageEventRow {
  id: string;
  application_id: string;
  from_stage: ApplicationStage | null;
  to_stage: ApplicationStage;
  actor_user_id: string | null;
  reason: string;
  metadata: Record<string, string> | null;
  created_at: string;
}

interface JewelCertInviteRow {
  id: string;
  application_id: string;
  store_id: string;
  assessment_package_id: string | null;
  sent_by_user_id: string | null;
  sent_to_email: string;
  status: JewelCertInviteRecord["status"];
  component_ids?: JsonArray;
  course_slugs?: JsonArray;
  expires_at: string | null;
  sent_at: string | null;
  completed_at: string | null;
}

interface JewelCertInviteListRow extends JewelCertInviteRow {
  applicant_profile_id: string | null;
  applicant_full_name: string | null;
  applicant_email: string | null;
  applicant_resume_headline: string | null;
  job_title: string | null;
}

interface GemMatchInviteRow {
  id: string;
  application_id: string | null;
  store_id: string;
  sent_by_user_id: string | null;
  status: GemMatchInviteRecord["status"];
  result_profile_code: GemMatchInviteRecord["resultProfileCode"] | null;
  fit_rating: GemMatchInviteRecord["fitRating"] | null;
  result_mix?: Mix | null;
  fit_score?: number | null;
  created_at: string;
  completed_at: string | null;
}

interface GemMatchInviteListRow extends GemMatchInviteRow {
  applicant_profile_id: string | null;
  applicant_full_name: string | null;
  applicant_email: string | null;
  applicant_resume_headline: string | null;
  job_title: string | null;
}

interface InterviewRow {
  id: string;
  application_id: string;
  store_id: string;
  scheduled_by_user_id: string | null;
  interviewer_user_ids: JsonArray;
  starts_at: string;
  ends_at: string | null;
  location_type: InterviewRecord["locationType"];
  location_details: string | null;
  status: InterviewRecord["status"];
  outcome: string | null;
  created_at: string;
  updated_at: string;
}

interface StoreInterviewListRow extends InterviewRow {
  applicant_profile_id: string | null;
  applicant_full_name: string | null;
  applicant_email: string | null;
  applicant_resume_headline: string | null;
  public_page_id: string | null;
  job_id: string | null;
  job_title: string | null;
  job_location: string | null;
  employment_type: PublicJobRecord["employmentType"] | null;
  compensation_summary: string | null;
  job_description: string | null;
  requirements: JsonArray;
  ideal_gemmatch_mix: JsonArray;
  required_assessment_ids: JsonArray;
  required_course_ids: JsonArray;
  job_status: PublicJobRecord["status"] | null;
  opened_at: string | null;
  closed_at: string | null;
}

interface ApplicantInterviewListRow extends StoreInterviewListRow {
  store_name: string | null;
  source: ApplicationRecord["source"];
  stage: ApplicationStage;
  status_reason: string | null;
  current_owner_user_id: string | null;
  submitted_at: string;
  last_activity_at: string;
  application_created_at: string;
  application_updated_at: string;
}

interface ApplicantNoteRow {
  id: string;
  application_id: string;
  store_id: string;
  author_user_id: string | null;
  body: string;
  visibility: ApplicantNoteRecord["visibility"];
  note_type: ApplicantNoteRecord["noteType"];
  created_at: string;
  updated_at: string;
}

interface HireSyncRow {
  id: string;
  application_id: string;
  store_id: string;
  jewellink_team_member_id: string | null;
  synced_by_user_id: string | null;
  sync_status: HireToJewelLinkSyncRecord["syncStatus"];
  payload_snapshot: HireToJewelLinkSyncRecord["payloadSnapshot"] | null;
  error_message: string | null;
  created_at: string;
  synced_at: string | null;
}

interface LocationRow {
  id: string;
  name: string;
  floor_type: string | null;
}

interface TeamMemberRow {
  id: string;
  store_id: string;
  location_id: string | null;
  jewellink_team_member_id: string | null;
  source_application_id: string | null;
  name: string;
  initials: string | null;
  role: string | null;
  gemmatch_type: string | null;
  primary_profile_code: ProfileCode | null;
  status: string;
  next_action: string | null;
  created_at: string;
  updated_at: string;
  location_name: string | null;
  floor_type: string | null;
}

interface CourseAssignmentRow {
  id: string;
  store_id: string;
  course_id: string;
  course_slug: string;
  course_title: string;
  recipient_type: "applicant" | "team_member";
  recipient_id: string;
  recipient_name: string | null;
  recipient_email: string | null;
  application_id: string | null;
  team_member_id: string | null;
  assigned_by_user_id: string | null;
  package_name: string | null;
  status: "not_started" | "in_progress" | "completed" | "expired" | "waived";
  progress_percent: number;
  source: "seed" | "manager" | "jewelcert" | "hire_handoff";
  assigned_at: string;
  due_at: string | null;
  completed_at: string | null;
  last_activity_at: string;
  credential_id: string | null;
  resource_location: string | null;
}

interface CourseCatalogRow {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  duration_minutes: number | null;
  description: string | null;
  status: "draft" | "published" | "archived";
  updated_at: string;
  assigned_count: string;
  in_progress_count: string;
  completed_count: string;
}

interface CourseTestRow {
  id: string;
  course_id: string;
  course_slug: string;
  course_title: string;
  title: string;
  passing_correct_count: number;
  question_count: number;
  status: CourseTestStatus;
  updated_at: string;
}

interface CourseTestQuestionRow {
  id: string;
  course_test_id: string;
  prompt: string;
  sort_order: number;
  status: CourseTestStatus;
}

interface CourseTestAnswerRow {
  id: string;
  question_id: string;
  label: string;
  sort_order: number;
  is_correct: boolean;
}

interface CourseTestAttemptRow {
  id: string;
  course_test_id: string;
  course_slug: string;
  assignment_id: string | null;
  recipient_id: string | null;
  started_at: string;
  completed_at: string;
  score_correct_count: number;
  score_percent: number;
  passed: boolean;
  answers: CourseTestAttempt["answers"] | null;
}

interface ApplicantResumeRow {
  profile_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  location: string | null;
  resume_headline: string | null;
  profile_summary: string | null;
  visibility: ApplicantProfileRecord["visibility"];
  profile_created_at: string;
  profile_updated_at: string;
  resume_id: string | null;
  resume_summary: string | null;
  work_experience: JsonArray;
  education: JsonArray;
  skills: JsonArray;
  portfolio_links: JsonArray;
  course_credential_ids: JsonArray;
  template_id: string | null;
  resume_updated_at: string | null;
}

export interface PostgresPublicStoreSnapshot {
  store: {
    id: string;
    name: string;
    slug: string;
    locationLabel?: string;
  };
  publicPage: StorePublicPageRecord;
  jobs: PublicJobRecord[];
}

export interface PostgresApplicationSummary {
  id: string;
  storeId: string;
  jobId: string;
  applicantProfileId: string;
  store?: {
    id: string;
    name: string;
  };
  application: ApplicationRecord;
  applicant: ApplicantProfileRecord;
  job?: {
    id: string;
    title: string;
    location?: string;
  };
  screening: {
    jewelcertStatus: string;
    gemmatchStatus: string;
    gemmatchProfile?: string;
    gemmatchFit?: string;
    gemmatchFitScore?: number;
  };
  nextInterview?: {
    startsAt: string;
    status?: string;
  };
  noteCount: number;
}

export interface ListPostgresApplicationSummariesInput {
  storeId: string;
  query?: string;
  stage?: ApplicationStage;
  limit?: number;
  offset?: number;
}

export interface CreatePostgresPublicApplicationInput {
  storeSlug: string;
  jobId?: string;
  submissionKeyHash?: string;
  attachment?: {
    originalFilename: string;
    mimeType: ApplicationAttachmentRecord["mimeType"];
    fileSizeBytes: number;
    sha256: string;
    content: Buffer;
  };
  profile: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    headline?: string;
    summary?: string;
    skills?: string[] | string;
    experience?: string[] | string;
    education?: string[] | string;
  };
}

export interface UpdatePostgresApplicationStageInput {
  applicationId: string;
  storeId: string;
  toStage: ApplicationStage;
  reason: string;
  actorUserId: string;
}

export interface PostgresApplicationScope {
  applicationId: string;
  storeId: string;
}

export interface ListPostgresStoreApplicantsInput {
  storeId: string;
  q?: string | null;
  scope?: string | null;
  role?: string | null;
}

export interface AddPostgresApplicantNoteInput {
  applicationId: string;
  storeId: string;
  body: string;
  noteType: ApplicantNoteRecord["noteType"];
  actorUserId: string;
}

export interface CreatePostgresJewelCertInviteInput {
  storeId: string;
  applicationId: string;
  componentIds?: string[];
  courseSlugs?: string[];
  actorUserId: string;
}

export interface ListPostgresStoreInterviewsInput {
  storeId: string;
  status?: InterviewRecord["status"];
}

export interface CreatePostgresInterviewInput {
  applicationId: string;
  storeId: string;
  actorUserId: string;
  date?: string;
  time?: string;
  startsAt?: string;
  duration?: number;
  type?: InterviewLocationType;
  location?: string;
  interviewer?: string;
  notes?: string;
  status?: InterviewRecord["status"];
}

export interface CreatePostgresNewCandidateInterviewInput extends Omit<CreatePostgresInterviewInput, "applicationId"> {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  jobId?: string;
  candidateLocation?: string;
  headline?: string;
  summary?: string;
}

export interface PostgresHirePreviewInput {
  applicationId: string;
  storeId: string;
  role?: string;
  locationId?: string | null;
}

export interface HirePostgresApplicationInput extends PostgresHirePreviewInput {
  actorUserId: string;
}

export interface ListPostgresCourseAssignmentsInput {
  storeId?: string | null;
  recipientId?: string | null;
  status?: string | null;
  courseSlug?: string | null;
}

export interface UpdatePostgresApplicantResumeInput {
  lookupEmail?: string | null;
  email?: string | null;
  fullName?: string;
  phone?: string;
  headline?: string;
  location?: string;
  summary?: string;
  workExperience?: string[];
  education?: string[];
  skills?: string[];
  portfolioLinks?: string[];
  templateId?: string;
}

export interface ApplicantNotificationPrefs {
  invites: boolean;
  interviews: boolean;
  status: boolean;
  marketing: boolean;
  updatedAt?: string;
}

export interface CreatePostgresCourseAssignmentsInput {
  storeId: string;
  courseSlug?: string;
  courseId?: string;
  recipientIds: string[];
  packageName?: string;
  dueAt?: string;
  source?: "seed" | "manager" | "jewelcert" | "hire_handoff";
  actorUserId: string;
}

export interface UpdatePostgresCourseAssignmentInput {
  assignmentId: string;
  progress?: number;
  status?: string;
  dueAt?: string | null;
  packageName?: string;
}

export interface CreatePostgresStoreJobInput {
  storeId: string;
  title?: string;
  location?: string;
  employmentType?: string;
  compensationSummary?: string;
  description?: string;
  requirements?: string[];
  idealGemMatchMix?: string[];
  requiredAssessmentIds?: string[];
  requiredCourseIds?: string[];
  status?: PublicJobRecord["status"];
}

export interface UpdatePostgresStoreJobInput {
  jobId: string;
  storeId?: string;
  title?: string;
  location?: string;
  employmentType?: string;
  compensationSummary?: string;
  description?: string;
  requirements?: string[];
  idealGemMatchMix?: string[];
  requiredAssessmentIds?: string[];
  requiredCourseIds?: string[];
  status?: PublicJobRecord["status"];
}

export interface ListPostgresStoreTeamMembersInput {
  storeId: string;
  locationId?: string | null;
}

export interface UpdatePostgresTeamMemberInput {
  memberId: string;
  locationId?: string | null;
  status?: string | null;
  nextAction?: string | null;
}

export interface CreatePostgresTeamMemberInput {
  storeId: string;
  name: string;
  role?: string;
  primary?: ProfileCode;
  type?: string;
  locationId?: string | null;
}

interface PostgresStoreJobRow extends PublicJobRow {
  applicants_count: string;
  unique_applicants_count: string;
  hired_count: string;
  active_pipeline_count: string;
}

interface StoreUserRow {
  id: string;
  store_id: string;
  company_id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface StoreSettingsRow {
  store_id: string;
  company_id: string;
  organization_company: string;
  organization_primary_store: string;
  default_manager: string;
  workflow: JsonArray;
  notifications: NotificationRule[] | null;
  updated_at: string;
}

interface StoreInviteSettingsRow {
  store_id: string;
  calendar_provider: CalProvider | null;
  account: string;
  from_name: string;
  reply_to: string;
  timezone: string;
  default_duration: string;
  location: string;
  add_links: boolean;
  attach_ics: boolean;
  remind24: boolean;
  remind1: boolean;
  note_template: string;
}

interface StoreIntegrationRow {
  id: string;
  store_id: string;
  provider: CalProvider;
  account: string;
  status: StoreIntegration["status"];
  scopes: JsonArray;
  connected_at: string | null;
}

interface AdminCompanyRow {
  id: string;
  name: string;
  owner_name: string | null;
  plan_tier: string;
  status: string;
  created_at: string;
  stores_count: string;
  seats_count: string;
  assessments_sent: string;
  hires_count: string;
}

interface AdminStoreRow {
  id: string;
  company_id: string;
  name: string;
  location_label: string | null;
}

interface AdminCompanyUserRow {
  id: string;
  company_id: string | null;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface BillingPlanRow {
  id: string;
  tier: string;
  price_cents: number;
  billing_interval: string;
  seats_label: string;
  features: JsonArray;
  status: string;
}

interface AdminInvoiceRow {
  id: string;
  company_name: string;
  amount_cents: number;
  status: string;
  issued_at: string;
}

interface AdminAuditRow {
  id: string;
  actor_label: string;
  action: string;
  target_label: string;
  metadata: Record<string, string> | null;
  created_at: string;
}

interface PublicPageConfigRow {
  page_id: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  location_label: string | null;
  template_id: string | null;
  logo_text: string | null;
  logo_asset_id: string | null;
  theme: Record<string, unknown> | null;
  job_layout: PublicPageConfig["jobLayout"] | null;
  headline: string;
  about: string | null;
  benefits: JsonArray;
  hours: JsonArray;
  review_summary: { rating?: number; count?: number } | null;
  show_reviews: boolean;
  status: PublicPageConfig["status"];
  updated_at: string;
  published_at: string | null;
  logo_storage_url: string | null;
}

interface PublicPageAssetRow {
  id: string;
  store_id: string;
  usage_context: PublicPageAsset["usageContext"];
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  storage_url: string;
  alt_text: string;
  source: PublicPageAsset["source"];
  created_at: string;
  updated_at: string;
}

interface PublicPageTestimonialRow {
  id: string;
  name: string;
  rating: number;
  text: string;
  source: NonNullable<PublicPageConfig["testimonials"][number]["source"]>;
  status: NonNullable<PublicPageConfig["testimonials"][number]["status"]>;
  created_at: string;
  updated_at: string;
}

interface PublicPageReviewRow {
  id: string;
  name: string;
  rating: number;
  text: string;
  when_label: string;
  source: PublicPageReview["source"];
  status: PublicPageReview["status"];
  created_at: string;
  updated_at: string;
}

interface PublicPagePreviewRow {
  id: string;
  store_id: string;
  generated_at: string;
  status: PublicPageConfig["status"];
  preview_url: string;
  snapshot: PublicPagePreview["snapshot"] | null;
}

interface AssessmentRow {
  id: string;
  store_id: string | null;
  owner: "admin" | "store";
  title: string;
  description: string;
  kind: AssessmentKind;
  status: CustomAssessment["status"];
  targets: JsonArray;
  media: JsonArray;
  question_count: number;
  duration_minutes: number;
  updated_at: string;
}

interface AssessmentQuestionRow {
  id: string;
  assessment_id: string;
  question_type: AssessmentQuestion["type"];
  prompt: string;
  options: JsonArray;
  answer_index: number | null;
  sort_order: number;
}

interface AssessmentResultRow {
  id: string;
  store_id: string;
  application_id: string | null;
  assessment_id: string | null;
  slug: string;
  title: string;
  result_type: AssessmentResult["type"];
  candidate: AssessmentResult["candidate"] | null;
  completed_at: string;
  duration_minutes: number;
  status: AssessmentResult["status"];
  total_score: number;
  score_label: string;
  summary: string;
  categories: AssessmentResult["categories"] | null;
  traits: AssessmentResult["traits"] | null;
  answer_review: AssessmentResult["answerReview"] | null;
  recommendation: AssessmentResult["recommendation"] | null;
  follow_ups: AssessmentResult["followUps"] | null;
  updated_at: string;
}

export type CreatePostgresPublicApplicationResult =
  | {
      error: string;
    }
  | {
      applicationId: string;
      duplicate: true;
    }
  | {
      applicationId: string;
      application: ApplicationRecord;
      profile: ApplicantProfileRecord;
      resume: ApplicantResumeRecord;
      job: PublicJobRecord;
    };

function asStringArray(value: JsonArray): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function optional(value: string | null | undefined) {
  return value || undefined;
}

function normalizeEmail(value: string | undefined) {
  return value?.trim().toLowerCase() || "";
}

function toList(value: string[] | string | undefined) {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function id(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function slugExpression(column: string) {
  return `regexp_replace(regexp_replace(lower(trim(${column})), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')`;
}

function resolvedJobLocationJoin(jobLocationColumn: string, storeIdColumn: string, alias: string) {
  const jobLocationSlug = slugExpression(jobLocationColumn);
  const candidateLocationSlug = slugExpression("candidate_location.name");
  return `
    left join lateral (
      select case
        when count(*) filter (where ${jobLocationSlug} = ${candidateLocationSlug}) = 1
          then min(candidate_location.id) filter (where ${jobLocationSlug} = ${candidateLocationSlug})
        when count(*) filter (where ${jobLocationSlug} = ${candidateLocationSlug}) = 0
          and count(*) = 1
          then min(candidate_location.id)
      end as location_id
      from locations candidate_location
      where candidate_location.store_id = ${storeIdColumn}
        and ${jobLocationSlug} <> ''
        and ${candidateLocationSlug} <> ''
        and (
          ${jobLocationSlug} = ${candidateLocationSlug}
          or ${jobLocationSlug} like ('%' || ${candidateLocationSlug} || '%')
          or ${candidateLocationSlug} like ('%' || ${jobLocationSlug} || '%')
        )
    ) ${alias} on true
  `;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function initials(value: string) {
  return value.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase() || "NA";
}

function profileMix(primary?: ProfileCode): Mix {
  if (primary === "V") return { V: 55, C: 10, F: 10, D: 25 };
  if (primary === "C") return { V: 10, C: 55, F: 25, D: 10 };
  if (primary === "F") return { V: 20, C: 10, F: 55, D: 15 };
  if (primary === "D") return { V: 25, C: 10, F: 10, D: 55 };
  return { V: 25, C: 25, F: 25, D: 25 };
}

function typeForPrimary(primary?: ProfileCode) {
  if (!primary) return "Balanced Associate";
  const secondary = PROFILE_ORDER.find((code) => code !== primary) || "C";
  return TYPE_BY_PAIR[primary][secondary] || PROFILES[primary].name;
}

function blendMix(current: Mix, incoming: Mix, teamSize: number): Mix {
  const blended = PROFILE_ORDER.map((profile) => ({
    profile,
    value: (current[profile] * teamSize + incoming[profile]) / Math.max(teamSize + 1, 1),
  }));
  const total = blended.reduce((sum, item) => sum + item.value, 0) || 1;
  const rounded = blended
    .map((item) => ({ profile: item.profile, value: Math.round((100 * item.value) / total) }))
    .sort((a, b) => b.value - a.value);
  let drift = 100 - rounded.reduce((sum, item) => sum + item.value, 0);
  let index = 0;
  while (drift !== 0 && rounded.length > 0) {
    rounded[index % rounded.length].value += drift > 0 ? 1 : -1;
    drift += drift > 0 ? -1 : 1;
    index += 1;
  }
  return Object.fromEntries(rounded.map((item) => [item.profile, item.value])) as Mix;
}

function mixDelta(before: Mix, after: Mix) {
  return Object.fromEntries(PROFILE_ORDER.map((profile) => [profile, after[profile] - before[profile]])) as Record<
    ProfileCode,
    number
  >;
}

function shortDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function inviteStatusLabel(status: JewelCertInviteRecord["status"]) {
  if (status === "completed") return "Completed";
  if (status === "started") return "Started";
  if (status === "expired") return "Expired";
  if (status === "cancelled") return "Expired";
  return "Sent";
}

function gemmatchFitScore(fit?: string): number | undefined {
  if (fit === "Strong fit") return 88;
  if (fit === "Good fit") return 74;
  if (fit === "Poor fit") return 32;
  return undefined;
}

function packageLabels(
  assessmentPackageId: string,
  customAssessments = new Map<string, string>(),
  courseTitles = new Map<string, string>(),
) {
  const ids = assessmentPackageId.split("+").filter(Boolean);
  const componentLabels = ids
    .filter((item) => !item.startsWith("course:") && !item.startsWith("package-"))
    .map((item) => CERT_COMPONENTS.find((component) => component.id === item)?.label || customAssessments.get(item) || item.replace(/^assessment:/, ""));
  const courseLabels = ids
    .filter((item) => item.startsWith("course:"))
    .map((item) => {
      const slug = item.replace(/^course:/, "");
      // Legacy CERT_COURSES first, then a builder-course title.
      return CERT_COURSES.find((course) => course.slug === slug)?.title || courseTitles.get(slug) || slug;
    });
  if (assessmentPackageId === "package-sales-associate-screen") {
    return {
      title: "Sales Associate screen",
      contents: "JewelCert profile, Sales Personality, Jewelry Basic Knowledge",
    };
  }
  if (assessmentPackageId === "package-bench-jeweler-screen") {
    return {
      title: "Bench readiness",
      contents: "JewelCert profile, Jewelry Basic Knowledge",
    };
  }
  const contents = [...componentLabels, ...courseLabels.map((label) => `Course: ${label}`)];
  return {
    title: componentLabels.length ? componentLabels.join(" + ") : courseLabels.length ? "Training follow-up" : "Custom JewelCert",
    contents: contents.join(", ") || "Custom JewelCert package",
  };
}

const PACKAGE_REQUIREMENTS: Record<string, { componentIds: string[]; courseSlugs: string[] }> = {
  "package-sales-associate-screen": {
    componentIds: ["gemmatch", "sales-personality", "jewelry-basic-knowledge"],
    courseSlugs: [],
  },
  "package-bench-jeweler-screen": {
    componentIds: ["gemmatch", "jewelry-basic-knowledge"],
    courseSlugs: [],
  },
};

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function resolveJewelCertRequirements(row: {
  assessment_package_id?: string | null;
  component_ids?: JsonArray;
  course_slugs?: JsonArray;
}) {
  const explicitComponents = asStringArray(row.component_ids || null);
  const explicitCourses = asStringArray(row.course_slugs || null);
  if (explicitComponents.length || explicitCourses.length) {
    return {
      componentIds: uniqueStrings(explicitComponents),
      courseSlugs: uniqueStrings(explicitCourses),
    };
  }

  const packageId = row.assessment_package_id || "";
  const known = PACKAGE_REQUIREMENTS[packageId];
  if (known) {
    return {
      componentIds: [...known.componentIds],
      courseSlugs: [...known.courseSlugs],
    };
  }

  const parts = packageId.split("+").map((part) => part.trim()).filter(Boolean);
  return {
    componentIds: uniqueStrings(parts.filter((part) => !part.startsWith("course:") && !part.startsWith("package-"))),
    courseSlugs: uniqueStrings(parts.filter((part) => part.startsWith("course:")).map((part) => part.replace(/^course:/, ""))),
  };
}

function assessmentEvidenceAliases(componentId: string) {
  const normalized = componentId.replace(/^assessment:/, "").trim();
  if (!normalized) return [];
  if (normalized === "jewelry-knowledge" || normalized === "jewelry-basic-knowledge") {
    return ["jewelry-knowledge", "jewelry-basic-knowledge"];
  }
  return [normalized];
}

function resolveInterviewStartsAt(input: { startsAt?: string; date?: string; time?: string }) {
  if (input.startsAt) return input.startsAt;
  return `${input.date || new Date().toISOString().slice(0, 10)}T${input.time || "15:00"}:00.000Z`;
}

function resolveInterviewEndsAt(startsAt: string, duration?: number) {
  const safeDuration = Number.isFinite(duration) ? Number(duration) : 30;
  const starts = new Date(startsAt);
  if (Number.isNaN(starts.getTime())) return new Date(Date.now() + safeDuration * 60 * 1000).toISOString();
  return new Date(starts.getTime() + safeDuration * 60 * 1000).toISOString();
}

function dbAssignmentStatusToLabel(status: CourseAssignmentRow["status"]): CourseAssignmentRecord["status"] {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

function labelAssignmentStatusToDb(status?: string | null): CourseAssignmentRow["status"] | undefined {
  if (!status) return undefined;
  const normalized = status.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "completed") return "completed";
  if (normalized === "in_progress") return "in_progress";
  if (normalized === "not_started") return "not_started";
  if (normalized === "expired") return "expired";
  if (normalized === "waived") return "waived";
  return undefined;
}

function teamStatusToLabel(status: string) {
  const normalized = status.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (normalized === "active") return "Active";
  if (normalized === "onboarding") return "Onboarding";
  if (normalized === "needs-review") return "Needs review";
  if (normalized === "on-leave") return "On leave";
  if (normalized === "removed") return "Removed";
  return status;
}

function teamStatusToDb(status?: string | null) {
  if (!status) return undefined;
  return status.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function mapTeamMember(row: TeamMemberRow) {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials || initials(row.name),
    role: row.role || "Team member",
    type: row.gemmatch_type || typeForPrimary(row.primary_profile_code || undefined),
    primary: row.primary_profile_code || "C",
    locationId: row.location_id || undefined,
    jewellinkTeamMemberId: row.jewellink_team_member_id || undefined,
    sourceApplicationId: row.source_application_id || undefined,
    status: teamStatusToLabel(row.status),
    location: row.location_name || row.location_id || undefined,
    nextAction: row.next_action || undefined,
  };
}

function mapCourseAssignment(row: CourseAssignmentRow) {
  const course = getCourse(row.course_slug);
  const stats = course
    ? courseStats(course)
    : { total: Math.max(1, Math.round(Number(row.progress_percent || 0) / 20)), done: 0, mins: 0 };
  const status = dbAssignmentStatusToLabel(row.status);
  return {
    id: row.id,
    course: course?.title || row.course_title,
    package: row.package_name || "Manager-assigned training",
    assignedBy: "Sissy's Log Cabin",
    progress: Number(row.progress_percent || 0),
    status,
    lessons: stats.total,
    credentialed: Boolean(row.credential_id) || status === "Completed",
    storeId: row.store_id,
    courseSlug: row.course_slug,
    recipientId: row.recipient_id,
    recipientName: row.recipient_name || row.recipient_id,
    recipientEmail: optional(row.recipient_email),
    recipientType: row.recipient_type,
    applicationId: optional(row.application_id),
    teamMemberId: optional(row.team_member_id),
    assignedByUserId: row.assigned_by_user_id || "system",
    assignedAt: row.assigned_at,
    dueAt: optional(row.due_at),
    source: row.source,
    courseStats: stats,
    lastActivityAt: row.last_activity_at,
    credentialId: optional(row.credential_id),
    resourceLocation: optional(row.resource_location),
  };
}

function mapCourseTestAnswer(row: CourseTestAnswerRow): CourseTestAnswer {
  return {
    id: row.id,
    label: row.label,
    sortOrder: Number(row.sort_order || 0),
    isCorrect: Boolean(row.is_correct),
  };
}

function mapCourseTestQuestion(row: CourseTestQuestionRow, answers: CourseTestAnswerRow[]): CourseTestQuestion {
  return {
    id: row.id,
    prompt: row.prompt,
    sortOrder: Number(row.sort_order || 0),
    status: row.status,
    answers: answers.sort((a, b) => Number(a.sort_order) - Number(b.sort_order)).map(mapCourseTestAnswer),
  };
}

function mapCourseCompletionTest(
  row: CourseTestRow,
  questions: CourseTestQuestionRow[],
  answersByQuestionId: Map<string, CourseTestAnswerRow[]>,
): CourseCompletionTest {
  return {
    id: row.id,
    courseSlug: row.course_slug,
    title: row.title,
    passingCorrectCount: Number(row.passing_correct_count || 0),
    questionCount: Number(row.question_count || 0),
    status: row.status,
    questions: questions
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
      .map((question) => mapCourseTestQuestion(question, answersByQuestionId.get(question.id) || [])),
    updatedAt: row.updated_at,
  };
}

function publicCourseCompletionTest(test: CourseCompletionTest) {
  return {
    ...test,
    questions: test.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      sortOrder: question.sortOrder,
      status: question.status,
      answers: question.answers.map((answer) => ({
        id: answer.id,
        label: answer.label,
        sortOrder: answer.sortOrder,
      })),
    })),
  };
}

function mapCourseTestAttempt(row: CourseTestAttemptRow): CourseTestAttempt {
  return {
    id: row.id,
    courseTestId: row.course_test_id,
    courseSlug: row.course_slug,
    assignmentId: optional(row.assignment_id),
    recipientId: optional(row.recipient_id),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    scoreCorrectCount: Number(row.score_correct_count || 0),
    scorePercent: Number(row.score_percent || 0),
    passed: Boolean(row.passed),
    answers: row.answers || [],
  };
}

function mapPublicPage(row: PublicStoreRow): StorePublicPageRecord {
  return {
    id: row.page_id,
    storeId: row.store_id,
    slug: row.page_slug,
    headline: row.headline,
    about: row.about || "",
    benefits: asStringArray(row.benefits),
    reviewSummary: {
      rating: Number(row.review_summary?.rating ?? 0),
      count: Number(row.review_summary?.count ?? 0),
    },
    status: row.status,
    publishedAt: optional(row.published_at),
    updatedAt: row.updated_at,
  };
}

function storeJobSlug(row: PublicJobRow) {
  if (row.id === "job-luxury-sales-associate") return "sales-associate";
  return row.slug || slugify(row.title) || row.id;
}

function jobLocationId(location?: string | null) {
  const normalized = (location || "").toLowerCase();
  if (normalized.includes("little rock")) return "location-little-rock";
  if (normalized.includes("memphis")) return "location-memphis";
  if (normalized.includes("jonesboro")) return "location-jonesboro";
  return null;
}

function locationFilterMatches(location: string | null | undefined, locationId?: string | null) {
  if (!locationId) return true;
  const locationSlug = slugify(location || "");
  const filterSlug = slugify(locationId.replace(/^location-/, ""));
  return Boolean(filterSlug && locationSlug.includes(filterSlug));
}

function mapPublicJob(row: PublicJobRow): PublicJobRecord & {
  slug: string;
  locationId: string | null;
  openings: number;
  views: number;
  applyClicks: number;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: row.id,
    slug: storeJobSlug(row),
    storeId: row.store_id,
    publicPageId: row.public_page_id,
    title: row.title,
    locationId: jobLocationId(row.location),
    location: row.location || "",
    employmentType: row.employment_type === "Part-time" ? "Part-time" : "Full-time",
    compensationSummary: row.compensation_summary || "",
    description: row.description || "",
    requirements: asStringArray(row.requirements),
    idealGemMatchMix: asStringArray(row.ideal_gemmatch_mix).filter((item): item is PublicJobRecord["idealGemMatchMix"][number] =>
      ["V", "C", "F", "D"].includes(item),
    ),
    requiredAssessmentIds: asStringArray(row.required_assessment_ids),
    requiredCourseIds: asStringArray(row.required_course_ids),
    status: row.status,
    openings: 1,
    views: Number(row.view_count || 0),
    applyClicks: Number(row.apply_click_count || 0),
    createdAt: row.created_at || row.opened_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.opened_at || new Date().toISOString(),
    openedAt: optional(row.opened_at),
    closedAt: optional(row.closed_at),
  };
}

function dbStoreUserRoleToLabel(role: string): UserRole {
  return role === "admin" || role === "store_owner" ? "Admin" : "Supervisor";
}

function labelStoreUserRoleToDb(role: UserRole) {
  return role === "Admin" ? "store_owner" : "supervisor";
}

function dbStoreUserStatusToLabel(status: string): ManagerUser["status"] {
  return status === "active" ? "Active" : "Invited";
}

function labelStoreUserStatusToDb(status?: ManagerUser["status"]) {
  if (status === "Active") return "active";
  if (status === "Invited") return "invited";
  return undefined;
}

function mapStoreUser(row: StoreUserRow): ManagerUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: dbStoreUserRoleToLabel(row.role),
    status: dbStoreUserStatusToLabel(row.status),
  };
}

function mapNotificationRules(value: NotificationRule[] | null): NotificationRule[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is NotificationRule => {
      return (
        typeof item === "object" &&
        item !== null &&
        typeof item.label === "string" &&
        typeof item.channel === "string" &&
        typeof item.owner === "string"
      );
    })
    .map((item) => ({ label: item.label, channel: item.channel, owner: item.owner }));
}

function mapStoreSettings(row: StoreSettingsRow): StoreSettingsRecord {
  return {
    storeId: row.store_id,
    organization: {
      company: row.organization_company,
      primaryStore: row.organization_primary_store,
      defaultManager: row.default_manager,
    },
    workflow: asStringArray(row.workflow),
    notifications: mapNotificationRules(row.notifications),
    updatedAt: row.updated_at,
  };
}

function integrationScopes(provider: CalProvider) {
  return provider === "google" ? ["calendar.events", "calendar.readonly", "gmail.send"] : ["Calendars.ReadWrite", "Mail.Send", "offline_access"];
}

function mapInviteSettings(row?: StoreInviteSettingsRow): InviteSettings {
  if (!row) return { ...INVITE_SETTINGS };
  return {
    calendarProvider: row.calendar_provider,
    account: row.account,
    fromName: row.from_name,
    replyTo: row.reply_to,
    timezone: row.timezone,
    defaultDuration: row.default_duration,
    location: row.location,
    addLinks: row.add_links,
    attachIcs: row.attach_ics,
    remind24: row.remind24,
    remind1: row.remind1,
    noteTemplate: row.note_template,
  };
}

function mapStoreIntegration(row: StoreIntegrationRow): StoreIntegration {
  return {
    provider: row.provider,
    label: PROVIDER_LABEL[row.provider],
    account: row.account,
    status: row.status,
    scopes: asStringArray(row.scopes),
    connectedAt: optional(row.connected_at),
  };
}

function dbPlanToLabel(plan?: string | null): PlanTier {
  const normalized = plan?.trim().toLowerCase();
  if (normalized === "pro") return "Pro";
  if (normalized === "growth") return "Growth";
  return "Starter";
}

function labelPlanToDb(plan?: PlanTier | null) {
  if (plan === "Pro") return "pro";
  if (plan === "Growth") return "growth";
  return "starter";
}

function dbCompanyStatusToLabel(status?: string | null): CompanyStatus {
  const normalized = status?.trim().toLowerCase();
  if (normalized === "active") return "Active";
  if (normalized === "paused" || normalized === "cancelled" || normalized === "suspended") return "Suspended";
  return "Trial";
}

function labelCompanyStatusToDb(status?: CompanyStatus | null) {
  if (status === "Active") return "active";
  if (status === "Suspended") return "paused";
  if (status === "Trial") return "trialing";
  return undefined;
}

function labelCompanyStatusToSubscriptionDb(status?: CompanyStatus | null) {
  if (status === "Active") return "active";
  if (status === "Suspended") return "past_due";
  if (status === "Trial") return "trialing";
  return undefined;
}

function labelAdminRoleToDb(role?: AdminCompanyUser["role"] | null) {
  return role === "Admin" ? "admin" : "supervisor";
}

function labelAdminUserStatusToDb(status?: AdminCompanyUser["status"] | null) {
  if (status === "Active") return "active";
  if (status === "Invited") return "invited";
  return undefined;
}

function shortMonthYear(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function adminTimestampLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function centsToMoney(cents: number) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function adminMetricsForPostgres(companies: AdminCompany[]) {
  const stores = companies.reduce((sum, company) => sum + company.stores.length, 0);
  const assessmentsSent = companies.reduce((sum, company) => sum + company.assessmentsSent, 0);
  const hires = companies.reduce((sum, company) => sum + company.hires, 0);
  return {
    companies: companies.length,
    active: companies.filter((company) => company.status === "Active").length,
    stores,
    assessmentsSent,
    hires,
  };
}

function mapAdminStore(row: AdminStoreRow) {
  return {
    id: row.id,
    name: row.name,
    location: row.location_label || row.name,
  };
}

function mapAdminCompanyUser(row: AdminCompanyUserRow): AdminCompanyUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role === "admin" || row.role === "store_owner" ? "Admin" : "Supervisor",
    status: row.status === "active" ? "Active" : "Invited",
  };
}

function mapAdminCompany(row: AdminCompanyRow, stores: AdminStoreRow[] = [], users: AdminCompanyUserRow[] = []): AdminCompany {
  return {
    id: row.id,
    name: row.name,
    owner: row.owner_name || users[0]?.name || "Owner",
    plan: dbPlanToLabel(row.plan_tier),
    status: dbCompanyStatusToLabel(row.status),
    createdAt: shortMonthYear(row.created_at),
    stores: stores.map(mapAdminStore),
    users: users.map(mapAdminCompanyUser),
    seats: Number(row.seats_count || users.length || 0),
    assessmentsSent: Number(row.assessments_sent || 0),
    hires: Number(row.hires_count || 0),
  };
}

function mapBillingPlan(row: BillingPlanRow) {
  return {
    tier: dbPlanToLabel(row.tier),
    price: row.billing_interval === "year" ? `${centsToMoney(row.price_cents)}/yr` : `${centsToMoney(row.price_cents).replace(".00", "")}/mo`,
    seats: row.seats_label,
    features: asStringArray(row.features),
  };
}

function mapAdminInvoice(row: AdminInvoiceRow) {
  const status: "Paid" | "Due" | "Past due" = row.status === "paid" ? "Paid" : row.status === "past_due" ? "Past due" : "Due";
  return {
    id: row.id,
    company: row.company_name,
    amount: centsToMoney(row.amount_cents),
    date: adminTimestampLabel(row.issued_at),
    status,
  };
}

function mapAdminAuditEntry(row: AdminAuditRow): AdminAuditEntry {
  return {
    id: row.id,
    actor: row.actor_label,
    action: row.action,
    target: row.target_label,
    at: adminTimestampLabel(row.created_at),
    metadata: row.metadata || undefined,
  };
}

function defaultIntegrationsFromSettings(settings: InviteSettings): StoreIntegration[] {
  return (["google", "microsoft"] as CalProvider[]).map((provider) => ({
    provider,
    label: PROVIDER_LABEL[provider],
    account: settings.calendarProvider === provider ? settings.account : "",
    status: settings.calendarProvider === provider ? "connected" : "disconnected",
    scopes: integrationScopes(provider),
    connectedAt: settings.calendarProvider === provider ? new Date().toISOString() : undefined,
  }));
}

function clampRating(value: unknown, fallback = 5) {
  return Math.max(1, Math.min(5, Math.round(Number(value) || fallback)));
}

function mapPublicPageTheme(theme: Record<string, unknown> | null): PublicPageConfig["theme"] {
  return {
    primary: typeof theme?.primary === "string" ? theme.primary : "#123FB9",
    accent: typeof theme?.accent === "string" ? theme.accent : "#2F7DFF",
    bg:
      typeof theme?.bg === "string"
        ? theme.bg
        : typeof theme?.background === "string"
          ? theme.background
          : "#f7f9ff",
    text: typeof theme?.text === "string" ? theme.text : "#08122B",
    fontId: typeof theme?.fontId === "string" ? theme.fontId : "inter",
  };
}

function mapPublicPageAsset(row: PublicPageAssetRow): PublicPageAsset {
  return {
    id: row.id,
    storeId: row.store_id,
    usageContext: row.usage_context,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSizeBytes: Number(row.file_size_bytes || 0),
    storageUrl: row.storage_url,
    altText: row.alt_text,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPublicPageTestimonial(row: PublicPageTestimonialRow): PublicPageConfig["testimonials"][number] {
  return {
    id: row.id,
    name: row.name,
    rating: clampRating(row.rating),
    text: row.text,
    source: row.source,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPublicPageReview(row: PublicPageReviewRow): PublicPageReview {
  return {
    id: row.id,
    name: row.name,
    rating: clampRating(row.rating),
    text: row.text,
    when: row.when_label,
    source: row.source,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPublicPagePreview(row: PublicPagePreviewRow): PublicPagePreview {
  return {
    id: row.id,
    storeId: row.store_id,
    generatedAt: row.generated_at,
    status: row.status,
    previewUrl: row.preview_url,
    snapshot: row.snapshot || {
      logoText: "",
      headline: "",
      testimonialCount: 0,
      reviewCount: 0,
      jobCount: 0,
    },
  };
}

function mapPublicPageConfig(row: PublicPageConfigRow, testimonials: PublicPageConfig["testimonials"]): PublicPageConfig {
  return {
    templateId: row.template_id || "modern-blue",
    logoText: row.logo_text || row.store_name,
    logoUrl: optional(row.logo_storage_url),
    logoAssetId: optional(row.logo_asset_id),
    theme: mapPublicPageTheme(row.theme),
    jobLayout: row.job_layout === "list" ? "list" : "cards",
    headline: row.headline,
    about: row.about || "",
    hours: (Array.isArray(row.hours) && row.hours.length ? row.hours : DEFAULT_HOURS).filter(
      (hour): hour is PublicPageConfig["hours"][number] =>
        typeof hour === "object" && hour !== null && "day" in hour && "hours" in hour,
    ),
    showReviews: row.show_reviews,
    testimonials,
    status: row.status,
  };
}

function dateLabel(value?: string) {
  if (!value) return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function mapAssessmentQuestion(row: AssessmentQuestionRow): AssessmentQuestion {
  const options = asStringArray(row.options);
  return {
    id: row.id,
    type: row.question_type,
    prompt: row.prompt,
    ...(options.length > 0 ? { options } : {}),
    ...(row.answer_index !== null ? { answerIndex: Number(row.answer_index) } : {}),
  };
}

function mapCustomAssessment(row: AssessmentRow, questions: AssessmentQuestionRow[]): CustomAssessment {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    kind: row.kind,
    owner: row.owner === "admin" ? "Admin" : "Store",
    status: row.status,
    questions: questions.sort((a, b) => Number(a.sort_order) - Number(b.sort_order)).map(mapAssessmentQuestion),
    updated: dateLabel(row.updated_at),
  };
}

function mapAssessmentResult(row: AssessmentResultRow): AssessmentResult {
  return {
    slug: row.slug,
    title: row.title,
    type: row.result_type,
    candidate: row.candidate || { id: "", name: "Candidate", initials: "NA", role: "" },
    completedAt: row.completed_at,
    durationMinutes: Number(row.duration_minutes || 0),
    status: row.status,
    totalScore: Number(row.total_score || 0),
    scoreLabel: row.score_label,
    summary: row.summary,
    ...(row.categories && row.categories.length > 0 ? { categories: row.categories } : {}),
    ...(row.traits && row.traits.length > 0 ? { traits: row.traits } : {}),
    answerReview: row.answer_review || [],
    recommendation: row.recommendation || { decision: "", text: "" },
    followUps: row.follow_ups || [],
  };
}

function assessmentQuestionId(assessmentId: string, question: AssessmentQuestion, index: number) {
  if (question.id && question.id.startsWith(`${assessmentId}-`)) return question.id;
  const rawId = question.id?.trim() || `q${index + 1}`;
  return `${assessmentId}-${slugify(rawId) || `q${index + 1}`}`;
}

function mapPostgresPublicJobForBuilder(row: PublicJobRow): PublicJob {
  return {
    id: row.id,
    title: row.title,
    type: row.employment_type === "Part-time" ? "Part-time" : "Full-time",
    location: row.location || "",
    salary: row.compensation_summary || "",
    blurb: row.description || "",
  };
}

function mapApplicationSummary(row: ApplicationSummaryRow): PostgresApplicationSummary {
  return {
    id: row.application_id,
    storeId: row.store_id,
    jobId: row.job_id || "",
    applicantProfileId: row.applicant_profile_id,
    store: row.store_name ? { id: row.store_id, name: row.store_name } : undefined,
    application: {
      id: row.application_id,
      storeId: row.store_id,
      jobId: row.job_id || "",
      applicantProfileId: row.applicant_profile_id,
      source: row.source,
      stage: row.stage,
      statusReason: optional(row.status_reason),
      currentOwnerUserId: optional(row.current_owner_user_id),
      submittedAt: row.submitted_at,
      lastActivityAt: row.last_activity_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    applicant: {
      id: row.applicant_profile_id,
      fullName: row.applicant_full_name,
      email: row.applicant_email,
      phone: row.applicant_phone || "",
      location: row.applicant_location || "",
      resumeHeadline: row.applicant_resume_headline || "",
      summary: row.applicant_summary || "",
      visibility: row.applicant_visibility,
      createdAt: row.applicant_created_at,
      updatedAt: row.applicant_updated_at,
    },
    job: row.job_id
      ? {
          id: row.job_id,
          title: row.job_title || "",
          location: optional(row.job_location),
        }
      : undefined,
    screening: {
      jewelcertStatus: row.jewelcert_status || "not_sent",
      gemmatchStatus: row.gemmatch_status || "not_sent",
      gemmatchProfile: optional(row.gemmatch_profile),
      gemmatchFit: optional(row.gemmatch_fit),
      gemmatchFitScore: row.gemmatch_fit_score ?? gemmatchFitScore(optional(row.gemmatch_fit)),
    },
    nextInterview: row.next_interview_at
      ? {
          startsAt: row.next_interview_at,
          status: optional(row.interview_status),
        }
      : undefined,
    noteCount: Number(row.note_count ?? 0),
  };
}

function statusFromStage(stage: ApplicationStage) {
  if (stage === "hired") return "Hired";
  if (stage === "rejected") return "Rejected";
  if (stage === "withdrawn") return "Withdrawn";
  return "Active";
}

function gemMatchLabel(profile?: string) {
  if (profile === "C") return "Luxury Advisor";
  if (profile === "F") return "Master Craftsman";
  if (profile === "D") return "Sales Strategist";
  if (profile === "V") return "Trailblazer";
  return "Luxury Advisor";
}

function gemMatchFitScore(fit?: string) {
  if (fit === "Strong fit") return 88;
  if (fit === "Poor fit") return 32;
  return 74;
}

function mapApplication(row: ApplicationDetailRow): ApplicationRecord {
  return {
    id: row.application_id,
    storeId: row.store_id,
    jobId: row.job_id || "",
    applicantProfileId: row.applicant_profile_id,
    source: row.source,
    stage: row.stage,
    statusReason: optional(row.status_reason),
    currentOwnerUserId: optional(row.current_owner_user_id),
    submittedAt: row.submitted_at,
    lastActivityAt: row.last_activity_at,
    createdAt: row.application_created_at,
    updatedAt: row.application_updated_at,
  };
}

function mapApplicantProfile(row: ApplicationDetailRow): ApplicantProfileRecord {
  return {
    id: row.applicant_profile_id,
    fullName: row.applicant_full_name,
    email: row.applicant_email,
    phone: row.applicant_phone || "",
    location: row.applicant_location || "",
    resumeHeadline: row.applicant_resume_headline || "",
    summary: row.applicant_summary || "",
    visibility: row.applicant_visibility,
    createdAt: row.applicant_created_at,
    updatedAt: row.applicant_updated_at,
  };
}

function mapApplicantResume(row: ApplicationDetailRow): ApplicantResumeRecord | undefined {
  if (!row.resume_id) return undefined;
  return {
    id: row.resume_id,
    applicantProfileId: row.applicant_profile_id,
    summary: row.resume_summary || "",
    workExperience: asStringArray(row.work_experience),
    education: asStringArray(row.education),
    skills: asStringArray(row.skills),
    portfolioLinks: asStringArray(row.portfolio_links),
    courseCredentialIds: asStringArray(row.course_credential_ids),
    updatedAt: row.resume_updated_at || row.applicant_updated_at,
  };
}

function mapApplicationAttachment(row: ApplicationAttachmentRow): ApplicationAttachmentRecord {
  return {
    id: row.id,
    applicationId: row.application_id,
    storeId: row.store_id,
    kind: row.kind,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSizeBytes: Number(row.file_size_bytes),
    sha256: row.sha256,
    createdAt: row.created_at,
  };
}

function mapApplicationJob(row: ApplicationDetailRow): PublicJobRecord | undefined {
  if (!row.job_id || !row.public_page_id || !row.job_status) return undefined;
  return mapPublicJob({
    id: row.job_id,
    store_id: row.store_id,
    public_page_id: row.public_page_id,
    title: row.job_title || "",
    location: row.job_location,
    employment_type: row.employment_type,
    compensation_summary: row.compensation_summary,
    description: row.job_description,
    requirements: row.requirements,
    ideal_gemmatch_mix: row.ideal_gemmatch_mix,
    required_assessment_ids: row.required_assessment_ids,
    required_course_ids: row.required_course_ids,
    status: row.job_status,
    opened_at: row.opened_at,
    closed_at: row.closed_at,
  });
}

function mapStoreInterviewJob(row: StoreInterviewListRow): PublicJobRecord | undefined {
  if (!row.job_id || !row.public_page_id || !row.job_status) return undefined;
  return mapPublicJob({
    id: row.job_id,
    store_id: row.store_id,
    public_page_id: row.public_page_id,
    title: row.job_title || "",
    location: row.job_location,
    employment_type: row.employment_type,
    compensation_summary: row.compensation_summary,
    description: row.job_description,
    requirements: row.requirements,
    ideal_gemmatch_mix: row.ideal_gemmatch_mix,
    required_assessment_ids: row.required_assessment_ids,
    required_course_ids: row.required_course_ids,
    status: row.job_status,
    opened_at: row.opened_at,
    closed_at: row.closed_at,
  });
}

function mapStageEvent(row: StageEventRow): ApplicationStageEventRecord {
  return {
    id: row.id,
    applicationId: row.application_id,
    fromStage: row.from_stage || undefined,
    toStage: row.to_stage,
    actorUserId: row.actor_user_id || "system",
    reason: row.reason,
    metadata: row.metadata || undefined,
    createdAt: row.created_at,
  };
}

function mapJewelCertInvite(row: JewelCertInviteRow): JewelCertInviteRecord {
  return {
    id: row.id,
    applicationId: row.application_id,
    storeId: row.store_id,
    assessmentPackageId: row.assessment_package_id || "",
    sentByUserId: row.sent_by_user_id || "system",
    sentToEmail: row.sent_to_email,
    status: row.status,
    expiresAt: optional(row.expires_at),
    sentAt: optional(row.sent_at),
    completedAt: optional(row.completed_at),
  };
}

function mapJewelCertInviteListItem(
  row: JewelCertInviteListRow,
  customAssessments = new Map<string, string>(),
  courseTitles = new Map<string, string>(),
) {
  const invite = mapJewelCertInvite(row);
  const labels = packageLabels(invite.assessmentPackageId, customAssessments, courseTitles);
  return {
    invite,
    candidate: row.applicant_full_name
      ? {
          id: slugify(row.applicant_full_name),
          profileId: row.applicant_profile_id || undefined,
          name: row.applicant_full_name,
          initials: initials(row.applicant_full_name),
          role: row.job_title || row.applicant_resume_headline || "Jewelry role",
          email: row.applicant_email || "",
        }
      : null,
    package: labels.title,
    contents: labels.contents,
    status: inviteStatusLabel(invite.status),
    sent: shortDate(invite.sentAt),
    due: shortDate(invite.expiresAt),
  };
}

async function hasPostgresCompletedGemMatchEvidence(client: PoolClient, row: JewelCertInviteRow) {
  const result = await client.query<{ exists: boolean }>(
    `
      select exists(
        select 1
        from gemmatch_invites
        where application_id = $1
          and store_id = $2
          and status = 'completed'
          and completed_at is not null
      )
    `,
    [row.application_id, row.store_id],
  );
  return Boolean(result.rows[0]?.exists);
}

async function hasPostgresAssessmentEvidence(client: PoolClient, row: JewelCertInviteRow, componentId: string) {
  const aliases = assessmentEvidenceAliases(componentId);
  if (!aliases.length) return false;
  const assessmentId = componentId.startsWith("assessment:") ? componentId.replace(/^assessment:/, "") : null;
  const result = await client.query<{ exists: boolean }>(
    `
      select exists(
        select 1
        from assessment_results
        where application_id = $1
          and store_id = $2
          and (
            slug = any($3::text[])
            or ($4::text is not null and assessment_id = $4)
          )
      )
    `,
    [row.application_id, row.store_id, aliases, assessmentId],
  );
  return Boolean(result.rows[0]?.exists);
}

async function hasPostgresCourseEvidence(client: PoolClient, row: JewelCertInviteRow, courseSlug: string) {
  const result = await client.query<{ exists: boolean }>(
    `
      select exists(
        select 1
        from course_assignments ca
        join courses c on c.id = ca.course_id
        join course_credentials cc on cc.course_assignment_id = ca.id
        where ca.application_id = $1
          and ca.store_id = $2
          and ca.recipient_type = 'applicant'
          and c.slug = $3
      )
    `,
    [row.application_id, row.store_id, courseSlug],
  );
  return Boolean(result.rows[0]?.exists);
}

async function reconcilePostgresJewelCertCompletionWithClient(
  client: PoolClient,
  input: { inviteId?: string; applicationId?: string },
) {
  if (!input.inviteId && !input.applicationId) return [];
  const result = await client.query<JewelCertInviteRow>(
    `
      select
        id, application_id, store_id, assessment_package_id, sent_by_user_id, sent_to_email,
        status, component_ids, course_slugs, expires_at::text, sent_at::text, completed_at::text
      from jewelcert_invites
      where status not in ('completed', 'expired', 'cancelled')
        and ($1::text is null or id = $1)
        and ($2::text is null or application_id = $2)
      order by sent_at desc nulls last, created_at desc
      for update
    `,
    [input.inviteId || null, input.applicationId || null],
  );

  const completed: JewelCertInviteRecord[] = [];
  const timestamp = new Date().toISOString();
  for (const row of result.rows) {
    const requirements = resolveJewelCertRequirements(row);
    const requiredComponents = requirements.componentIds.filter((componentId) => componentId !== "gemmatch");
    const hasAnyRequirement =
      requirements.componentIds.length > 0 || requirements.courseSlugs.length > 0;
    if (!hasAnyRequirement) continue;

    const gemmatchReady =
      !requirements.componentIds.includes("gemmatch") || await hasPostgresCompletedGemMatchEvidence(client, row);
    if (!gemmatchReady) continue;

    let assessmentsReady = true;
    for (const componentId of requiredComponents) {
      if (!await hasPostgresAssessmentEvidence(client, row, componentId)) {
        assessmentsReady = false;
        break;
      }
    }
    if (!assessmentsReady) continue;

    let coursesReady = true;
    for (const courseSlug of requirements.courseSlugs) {
      if (!await hasPostgresCourseEvidence(client, row, courseSlug)) {
        coursesReady = false;
        break;
      }
    }
    if (!coursesReady) continue;

    const updated = await client.query<JewelCertInviteRow>(
      `
        update jewelcert_invites
        set status = 'completed',
            completed_at = coalesce(completed_at, $1)
        where id = $2
        returning
          id, application_id, store_id, assessment_package_id, sent_by_user_id, sent_to_email,
          status, component_ids, course_slugs, expires_at::text, sent_at::text, completed_at::text
      `,
      [timestamp, row.id],
    );
    if (updated.rows[0]) completed.push(mapJewelCertInvite(updated.rows[0]));
  }
  return completed;
}

export async function reconcilePostgresJewelCertCompletion(input: { inviteId?: string; applicationId?: string }) {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const completed = await reconcilePostgresJewelCertCompletionWithClient(client, input);
    await client.query("commit");
    return completed;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function mapGemMatchInvite(row: GemMatchInviteRow): GemMatchInviteRecord {
  return {
    id: row.id,
    applicationId: row.application_id || "",
    storeId: row.store_id,
    sentByUserId: row.sent_by_user_id || "system",
    status: row.status,
    resultProfileCode: row.result_profile_code || undefined,
    fitRating: row.fit_rating || undefined,
    resultMix: row.result_mix ?? undefined,
    fitScore: row.fit_score ?? undefined,
    completedAt: optional(row.completed_at),
    createdAt: row.created_at,
  };
}

function mapGemMatchInviteListItem(row: GemMatchInviteListRow) {
  const invite = mapGemMatchInvite(row);
  return {
    invite,
    applicant: row.applicant_full_name
      ? {
          id: row.applicant_profile_id || slugify(row.applicant_full_name),
          name: row.applicant_full_name,
          initials: initials(row.applicant_full_name),
          role: row.job_title || row.applicant_resume_headline || "Jewelry role",
          email: row.applicant_email || "",
        }
      : null,
    sentDate: shortDate(invite.createdAt),
    status: invite.status === "completed" ? "Completed" : invite.status === "started" ? "Started" : "Sent",
    type: typeForPrimary(invite.resultProfileCode),
    primary: invite.resultProfileCode,
    fitScore: gemmatchFitScore(invite.fitRating),
    fitTier: invite.fitRating,
  };
}

function mapInterview(row: InterviewRow): InterviewRecord {
  return {
    id: row.id,
    applicationId: row.application_id,
    storeId: row.store_id,
    scheduledByUserId: row.scheduled_by_user_id || "system",
    interviewerUserIds: asStringArray(row.interviewer_user_ids),
    startsAt: row.starts_at,
    endsAt: row.ends_at || row.starts_at,
    locationType: row.location_type,
    locationDetails: row.location_details || "",
    status: row.status,
    outcome: optional(row.outcome),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStoreInterviewListItem(row: StoreInterviewListRow) {
  return {
    interview: mapInterview(row),
    applicant: row.applicant_full_name
      ? {
          id: slugify(row.applicant_full_name),
          profileId: row.applicant_profile_id || undefined,
          name: row.applicant_full_name,
          initials: initials(row.applicant_full_name),
          role: row.job_title || row.applicant_resume_headline || "Jewelry role",
          email: row.applicant_email || "",
        }
      : null,
    job: mapStoreInterviewJob(row),
  };
}

function mapApplicantInterviewListItem(row: ApplicantInterviewListRow) {
  return {
    ...mapInterview(row),
    store: row.store_name ? { id: row.store_id, name: row.store_name } : undefined,
    application: {
      id: row.application_id,
      storeId: row.store_id,
      jobId: row.job_id || "",
      applicantProfileId: row.applicant_profile_id || "",
      source: row.source,
      stage: row.stage,
      statusReason: optional(row.status_reason),
      currentOwnerUserId: optional(row.current_owner_user_id),
      submittedAt: row.submitted_at,
      lastActivityAt: row.last_activity_at,
      createdAt: row.application_created_at,
      updatedAt: row.application_updated_at,
    } satisfies ApplicationRecord,
    job: mapStoreInterviewJob(row),
  };
}

function mapApplicantNote(row: ApplicantNoteRow): ApplicantNoteRecord {
  return {
    id: row.id,
    applicationId: row.application_id,
    storeId: row.store_id,
    authorUserId: row.author_user_id || "system",
    body: row.body,
    visibility: row.visibility,
    noteType: row.note_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHireSync(row: HireSyncRow): HireToJewelLinkSyncRecord {
  return {
    id: row.id,
    applicationId: row.application_id,
    storeId: row.store_id,
    jewellinkTeamMemberId: optional(row.jewellink_team_member_id),
    syncedByUserId: row.synced_by_user_id || "system",
    syncStatus: row.sync_status,
    payloadSnapshot: row.payload_snapshot || { fullName: "", role: "", courseCredentialIds: [] },
    errorMessage: optional(row.error_message),
    createdAt: row.created_at,
    syncedAt: optional(row.synced_at),
  };
}

export async function getPostgresPublicStoreSnapshot(storeSlug: string): Promise<PostgresPublicStoreSnapshot | undefined> {
  const pageResult = await getPostgresPool().query<PublicStoreRow>(
    `
      select
        spp.id as page_id,
        s.id as store_id,
        s.name as store_name,
        s.slug as store_slug,
        s.location_label,
        spp.slug as page_slug,
        spp.headline,
        spp.about,
        spp.benefits,
        spp.review_summary,
        spp.status,
        spp.published_at::text,
        spp.updated_at::text
      from store_public_pages spp
      join stores s on s.id = spp.store_id
      where spp.slug = $1
        and spp.status = 'published'
        and s.status = 'active'
      limit 1
    `,
    [storeSlug],
  );
  const pageRow = pageResult.rows[0];
  if (!pageRow) return undefined;

  const jobsResult = await getPostgresPool().query<PublicJobRow>(
    `
      select
        id,
        store_id,
        public_page_id,
        title,
        location,
        employment_type,
        compensation_summary,
        description,
        requirements,
        ideal_gemmatch_mix,
        required_assessment_ids,
        required_course_ids,
        status,
        opened_at::text,
        closed_at::text,
        view_count,
        apply_click_count
      from public_jobs
      where store_id = $1
        and status = 'open'
      order by opened_at desc nulls last, created_at desc
    `,
    [pageRow.store_id],
  );

  return {
    store: {
      id: pageRow.store_id,
      name: pageRow.store_name,
      slug: pageRow.store_slug,
      locationLabel: optional(pageRow.location_label),
    },
    publicPage: mapPublicPage(pageRow),
    jobs: jobsResult.rows.map(mapPublicJob),
  };
}

async function listPostgresStoreJobsWithClient(client: PoolClient, storeId: string, locationId?: string | null) {
  const result = await client.query<PostgresStoreJobRow>(
    `
      select
        pj.id,
        pj.store_id,
        pj.public_page_id,
        pj.slug,
        pj.title,
        pj.location,
        pj.employment_type,
        pj.compensation_summary,
        pj.description,
        pj.requirements,
        pj.ideal_gemmatch_mix,
        pj.required_assessment_ids,
        pj.required_course_ids,
        pj.status,
        pj.opened_at::text,
        pj.closed_at::text,
        pj.created_at::text,
        pj.updated_at::text,
        pj.view_count,
        pj.apply_click_count,
        count(a.id)::text as applicants_count,
        count(distinct a.applicant_profile_id)::text as unique_applicants_count,
        count(a.id) filter (where a.stage = 'hired')::text as hired_count,
        count(a.id) filter (where a.stage not in ('hired', 'rejected', 'withdrawn'))::text as active_pipeline_count
      from public_jobs pj
      left join applications a on a.job_id = pj.id and a.store_id = pj.store_id
      where pj.store_id = $1
      group by
        pj.id,
        pj.store_id,
        pj.public_page_id,
        pj.slug,
        pj.title,
        pj.location,
        pj.employment_type,
        pj.compensation_summary,
        pj.description,
        pj.requirements,
        pj.ideal_gemmatch_mix,
        pj.required_assessment_ids,
        pj.required_course_ids,
        pj.status,
        pj.opened_at,
        pj.closed_at,
        pj.created_at,
        pj.updated_at,
        pj.view_count,
        pj.apply_click_count
      order by
        case pj.status
          when 'open' then 0
          when 'draft' then 1
          when 'paused' then 2
          else 3
        end,
        pj.opened_at desc nulls last,
        pj.created_at desc
    `,
    [storeId],
  );

  return result.rows
    .filter((row) => locationFilterMatches(row.location, locationId))
    .map((row) => {
      const job = mapPublicJob(row);
      return {
        job,
        kpis: {
          applicants: Number(row.applicants_count || 0),
          uniqueApplicants: Number(row.unique_applicants_count || 0),
          hired: Number(row.hired_count || 0),
          activePipeline: Number(row.active_pipeline_count || 0),
          views: job.views,
          applyClicks: job.applyClicks,
        },
      };
    });
}

export async function listPostgresStoreJobs(storeId: string, locationId?: string | null) {
  const client = await getPostgresPool().connect();
  try {
    return await listPostgresStoreJobsWithClient(client, storeId, locationId);
  } finally {
    client.release();
  }
}

export async function createPostgresStoreJob(input: CreatePostgresStoreJobInput) {
  const title = input.title?.trim();
  if (!title) return undefined;
  const timestamp = new Date().toISOString();
  const status = input.status && ["draft", "open", "paused", "closed"].includes(input.status) ? input.status : "draft";
  const slug = slugify(title) || `job-${Date.now().toString(36)}`;
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const publicPage = await client.query<{ id: string }>(
      `
        select id
        from store_public_pages
        where store_id = $1
        order by
          case status when 'published' then 0 when 'draft' then 1 else 2 end,
          updated_at desc
        limit 1
      `,
      [input.storeId],
    );
    const result = await client.query<PublicJobRow>(
      `
        insert into public_jobs (
          id,
          store_id,
          public_page_id,
          slug,
          title,
          location,
          employment_type,
          compensation_summary,
          description,
          requirements,
          ideal_gemmatch_mix,
          required_assessment_ids,
          required_course_ids,
          status,
          opened_at,
          created_at,
          updated_at
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb,
          $14, $15, $16, $16
        )
        on conflict (store_id, slug) do update set
          title = excluded.title,
          location = excluded.location,
          employment_type = excluded.employment_type,
          compensation_summary = excluded.compensation_summary,
          description = excluded.description,
          requirements = excluded.requirements,
          ideal_gemmatch_mix = excluded.ideal_gemmatch_mix,
          required_assessment_ids = excluded.required_assessment_ids,
          required_course_ids = excluded.required_course_ids,
          status = excluded.status,
          opened_at = coalesce(public_jobs.opened_at, excluded.opened_at),
          updated_at = excluded.updated_at
        returning
          id,
          store_id,
          public_page_id,
          slug,
          title,
          location,
          employment_type,
          compensation_summary,
          description,
          requirements,
          ideal_gemmatch_mix,
          required_assessment_ids,
          required_course_ids,
          status,
          opened_at::text,
          closed_at::text,
          created_at::text,
          updated_at::text,
          view_count,
          apply_click_count
      `,
      [
        id("job"),
        input.storeId,
        publicPage.rows[0]?.id || null,
        slug,
        title,
        input.location?.trim() || null,
        input.employmentType?.trim() || "Full-time",
        input.compensationSummary?.trim() || "",
        input.description?.trim() || "",
        JSON.stringify(input.requirements || []),
        JSON.stringify(input.idealGemMatchMix || []),
        JSON.stringify(input.requiredAssessmentIds || []),
        JSON.stringify(input.requiredCourseIds || []),
        status,
        status === "open" ? timestamp : null,
        timestamp,
      ],
    );
    await client.query("commit");
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      job: mapPublicJob(row),
      kpis: {
        applicants: 0,
        uniqueApplicants: 0,
        hired: 0,
        activePipeline: 0,
        views: 0,
        applyClicks: 0,
      },
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePostgresStoreJob(input: UpdatePostgresStoreJobInput) {
  const current = await resolvePostgresJobBySlug(input.jobId, input.storeId);
  if (!current) return undefined;
  const timestamp = new Date().toISOString();
  const nextStatus = input.status && ["draft", "open", "paused", "closed"].includes(input.status) ? input.status : current.status;
  const result = await getPostgresPool().query<PublicJobRow>(
    `
      update public_jobs
      set
        title = coalesce($2, title),
        location = coalesce($3, location),
        employment_type = coalesce($4, employment_type),
        compensation_summary = coalesce($5, compensation_summary),
        description = coalesce($6, description),
        requirements = coalesce($7::jsonb, requirements),
        ideal_gemmatch_mix = coalesce($8::jsonb, ideal_gemmatch_mix),
        required_assessment_ids = coalesce($9::jsonb, required_assessment_ids),
        required_course_ids = coalesce($10::jsonb, required_course_ids),
        status = $11,
        opened_at = case
          when $11 = 'open' and opened_at is null then $12::timestamptz
          when $11 = 'open' then opened_at
          else opened_at
        end,
        closed_at = case
          when $11 = 'closed' then $12::timestamptz
          when $11 = 'open' then null
          else closed_at
        end,
        updated_at = $12::timestamptz
      where id = $1
      returning
        id,
        store_id,
        public_page_id,
        slug,
        title,
        location,
        employment_type,
        compensation_summary,
        description,
        requirements,
        ideal_gemmatch_mix,
        required_assessment_ids,
        required_course_ids,
        status,
        opened_at::text,
        closed_at::text,
        created_at::text,
        updated_at::text,
        view_count,
        apply_click_count
    `,
    [
      current.id,
      input.title?.trim() || null,
      input.location?.trim() || null,
      input.employmentType?.trim() || null,
      input.compensationSummary?.trim() || null,
      input.description?.trim() || null,
      Array.isArray(input.requirements) ? JSON.stringify(input.requirements) : null,
      Array.isArray(input.idealGemMatchMix) ? JSON.stringify(input.idealGemMatchMix) : null,
      Array.isArray(input.requiredAssessmentIds) ? JSON.stringify(input.requiredAssessmentIds) : null,
      Array.isArray(input.requiredCourseIds) ? JSON.stringify(input.requiredCourseIds) : null,
      nextStatus,
      timestamp,
    ],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return getPostgresJobDetail(row.id, input.storeId);
}

async function resolvePostgresJobBySlug(slug: string, storeId?: string) {
  const normalized = slugify(slug);
  const candidates = Array.from(new Set([slug, normalized, `job-${normalized}`].filter(Boolean)));
  const values: unknown[] = [candidates, normalized];
  const storeClause = storeId ? "and store_id = $3" : "";
  if (storeId) values.push(storeId);
  const result = await getPostgresPool().query<PublicJobRow>(
    `
      select
        id,
        store_id,
        public_page_id,
        slug,
        title,
        location,
        employment_type,
        compensation_summary,
        description,
        requirements,
        ideal_gemmatch_mix,
        required_assessment_ids,
        required_course_ids,
        status,
        opened_at::text,
        closed_at::text,
        created_at::text,
        updated_at::text,
        view_count,
        apply_click_count
      from public_jobs
      where (
        id = any($1::text[])
        or slug = any($1::text[])
        or slug = $2
        or slug like '%' || $2
        or ${slugExpression("id")} = $2
        or ${slugExpression("title")} = $2
      )
      ${storeClause}
      order by
        case status when 'open' then 0 when 'draft' then 1 when 'paused' then 2 else 3 end,
        opened_at desc nulls last,
        created_at desc
      limit 1
    `,
    values,
  );
  const row = result.rows[0];
  return row ? mapPublicJob(row) : undefined;
}

export async function getPostgresJobDetail(slug: string, storeId?: string) {
  const job = await resolvePostgresJobBySlug(slug, storeId);
  if (!job) return undefined;
  const jobRows = await listPostgresStoreJobs(job.storeId);
  const applications = await listPostgresApplicationSummaries({ storeId: job.storeId, limit: 100 });
  const applicants = applications.items.filter((item) => item.application.jobId === job.id);
  const kpis = jobRows.find((item) => item.job.id === job.id)?.kpis || {
    applicants: applicants.length,
    uniqueApplicants: new Set(applicants.map((item) => item.application.applicantProfileId)).size,
    hired: applicants.filter((item) => item.application.stage === "hired").length,
    activePipeline: applicants.filter((item) => !["hired", "rejected", "withdrawn"].includes(item.application.stage)).length,
  };
  return {
    job,
    applicants,
    kpis: {
      total: kpis.applicants,
      unique: kpis.uniqueApplicants,
      hired: kpis.hired,
      activePipeline: kpis.activePipeline,
    },
  };
}

async function getPostgresCareersAnalyticsWithClient(client: PoolClient, storeId: string, rangeDays = 30) {
  const boundedDays = Math.min(Math.max(Math.round(rangeDays) || 30, 1), 90);
  const pageResult = await client.query<{ id: string; slug: string; status: "draft" | "published" | "paused" }>(
    "select id, slug, status from store_public_pages where store_id = $1 order by updated_at desc limit 1",
    [storeId],
  );
  const page = pageResult.rows[0];
  const publicBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://app.jewelhire.com").replace(/\/$/, "");
  if (!page) {
    return { slug: "", url: "", status: "Draft" as const, views30d: 0, applyStarts: 0, submissions: 0, applyRate: 0, trend: [0, 0] };
  }
  const metrics = await client.query<{ event_date: string; page_views: string; application_starts: string }>(
    `
      select
        day::date::text as event_date,
        coalesce(sum(e.event_count) filter (where e.event_type = 'page_view'), 0)::text as page_views,
        coalesce(sum(e.event_count) filter (where e.event_type = 'application_start'), 0)::text as application_starts
      from generate_series(current_date - ($2::int - 1), current_date, interval '1 day') day
      left join public_careers_daily_events e
        on e.public_page_id = $1 and e.event_date = day::date
      group by day
      order by day
    `,
    [page.id, boundedDays],
  );
  const submissionResult = await client.query<{ count: string }>(
    `
      select count(*)::text as count
      from applications
      where store_id = $1
        and source = 'public_store_page'
        and submitted_at >= current_date - ($2::int - 1)
    `,
    [storeId, boundedDays],
  );
  const views = metrics.rows.reduce((sum, row) => sum + Number(row.page_views || 0), 0);
  const starts = metrics.rows.reduce((sum, row) => sum + Number(row.application_starts || 0), 0);
  const submissions = Number(submissionResult.rows[0]?.count || 0);
  return {
    slug: page.slug,
    url: `${publicBaseUrl}/careers/${encodeURIComponent(page.slug)}`,
    status: page.status === "published" ? "Published" as const : page.status === "paused" ? "Paused" as const : "Draft" as const,
    views30d: views,
    applyStarts: starts,
    submissions,
    applyRate: starts ? Math.min(100, Math.round((submissions / starts) * 100)) : 0,
    trend: metrics.rows.map((row) => Number(row.page_views || 0)),
  };
}

export async function getPostgresCareersAnalytics(storeId: string, rangeDays = 30) {
  const client = await getPostgresPool().connect();
  try {
    return await getPostgresCareersAnalyticsWithClient(client, storeId, rangeDays);
  } finally {
    client.release();
  }
}

async function getPostgresDashboardLocationsWithClient(client: PoolClient, storeId: string) {
  const result = await client.query<{ id: string; name: string; floor_type: string | null; member_count: string }>(
    `
      select l.id, l.name, l.floor_type, count(tm.id)::text as member_count
      from locations l
      left join team_members tm on tm.location_id = l.id and tm.status <> 'removed'
      where l.store_id = $1
      group by l.id, l.name, l.floor_type, l.created_at
      order by l.created_at asc, l.name asc
    `,
    [storeId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    count: Number(row.member_count || 0),
    archetype: row.floor_type || "Not set",
  }));
}

function relativeActivityTime(value: string) {
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (elapsedMinutes < 60) return `${Math.max(1, elapsedMinutes)}m`;
  const hours = Math.round(elapsedMinutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

async function getPostgresDashboardActivityWithClient(client: PoolClient, storeId: string) {
  const result = await client.query<{ event_type: string; subject_id: string; payload: Record<string, unknown> | null; created_at: string }>(
    `
      select event_type, subject_id, payload, created_at::text
      from domain_events
      where store_id = $1
        and event_type in ('application.created', 'interview.scheduled', 'assessment.completed')
      order by created_at desc
      limit 8
    `,
    [storeId],
  );
  return result.rows.map((row) => {
    const applicationId = typeof row.payload?.applicationId === "string" ? row.payload.applicationId : row.subject_id;
    if (row.event_type === "interview.scheduled") {
      return { icon: "interview" as const, text: "Interview scheduled", when: relativeActivityTime(row.created_at), href: "/interviews" };
    }
    if (row.event_type === "assessment.completed") {
      return { icon: "gemmatch" as const, text: "Assessment completed", when: relativeActivityTime(row.created_at), href: `/applicants/${encodeURIComponent(applicationId)}` };
    }
    return { icon: "apply" as const, text: "New application received", when: relativeActivityTime(row.created_at), href: `/applicants/${encodeURIComponent(applicationId)}` };
  });
}

export async function getPostgresStoreDashboard(storeId: string, locationId?: string | null) {
  const client = await getPostgresPool().connect();
  try {
    const jobs = await listPostgresStoreJobsWithClient(client, storeId, locationId);
    const applicationSummaries = await listPostgresApplicationSummariesWithClient(client, { storeId, limit: 100 });
    const applications = locationId
      ? applicationSummaries.items.filter((item) => locationFilterMatches(item.job?.location || item.applicant.location, locationId))
      : applicationSummaries.items;
    const composition = await getPostgresTeamComposition(client, storeId);
    const locations = await getPostgresDashboardLocationsWithClient(client, storeId);
    const selectedLocation = locationId
      ? locations.find((location) => locationFilterMatches(location.name, locationId) || location.id === locationId)
      : undefined;
    const applicants = applications.length;
    const hired = applications.filter((item) => item.application.stage === "hired").length;
    const completed = applications.filter((item) => item.screening.gemmatchStatus === "completed");
    const fitScores = completed.map((item) => gemmatchFitScore(item.screening.gemmatchFit)).filter((score): score is number => score !== undefined);
    const activeJobs = jobs.filter((item) => item.job.status === "open").length;
    const floor = selectedLocation
      ? floorRead(composition.mix, selectedLocation.archetype, selectedLocation.count, selectedLocation.count)
      : floorRead(composition.mix, composition.floorType, composition.tested, Math.max(composition.total, composition.tested));
    const careers = await getPostgresCareersAnalyticsWithClient(client, storeId, 30);
    const activity = await getPostgresDashboardActivityWithClient(client, storeId);

    return {
      storeId,
      selectedLocationId: locationId || null,
      floor,
      jobs,
      kpis: {
        activeJobs,
        applicants,
        hired,
        avgFit: fitScores.length ? Math.round(fitScores.reduce((sum, score) => sum + score, 0) / fitScores.length) : 0,
        gemmatchCompletion: applicants ? Math.round((completed.length / applicants) * 100) : 0,
      },
      careers,
      locations,
      activity,
    };
  } finally {
    client.release();
  }
}

async function getPostgresPublicPageRow(client: PoolClient, input: { storeId?: string; slug?: string }) {
  const result = await client.query<PublicPageConfigRow>(
    `
      select
        spp.id as page_id,
        spp.store_id,
        s.name as store_name,
        s.slug as store_slug,
        s.location_label,
        spp.template_id,
        spp.logo_text,
        spp.logo_asset_id,
        spp.theme,
        spp.job_layout,
        spp.headline,
        spp.about,
        spp.benefits,
        spp.hours,
        spp.review_summary,
        spp.show_reviews,
        spp.status,
        spp.updated_at::text,
        spp.published_at::text,
        logo.storage_url as logo_storage_url
      from store_public_pages spp
      join stores s on s.id = spp.store_id
      left join public_page_assets logo on logo.id = spp.logo_asset_id
      where ($1::text is null or spp.store_id = $1)
        and ($2::text is null or spp.slug = $2)
      order by spp.updated_at desc
      limit 1
    `,
    [input.storeId || null, input.slug || null],
  );
  return result.rows[0];
}

async function ensurePostgresPublicPage(client: PoolClient, storeId: string) {
  const existing = await getPostgresPublicPageRow(client, { storeId });
  if (existing) return existing;

  const storeResult = await client.query<{ id: string; name: string; slug: string; location_label: string | null }>(
    "select id, name, slug, location_label from stores where id = $1 limit 1",
    [storeId],
  );
  const store = storeResult.rows[0];
  if (!store) return undefined;

  const timestamp = new Date().toISOString();
  await client.query(
    `
      insert into store_public_pages (
        id, store_id, slug, template_id, logo_text, theme, job_layout, headline, about, benefits,
        hours, review_summary, show_reviews, status, created_at, updated_at
      )
      values (
        $1,
        $2,
        $3,
        'modern-blue',
        $4,
        $5::jsonb,
        'cards',
        'Build a career in fine jewelry.',
        $6,
        $7::jsonb,
        $8::jsonb,
        $9::jsonb,
        true,
        'draft',
        $10,
        $10
      )
    `,
    [
      `public-page-${slugify(store.slug || storeId)}`,
      storeId,
      store.slug || `store-${slugify(storeId)}`,
      store.name,
      JSON.stringify({ primary: "#123FB9", accent: "#2F7DFF", bg: "#f7f9ff", text: "#08122B", fontId: "inter" }),
      STORE.about,
      JSON.stringify(STORE.benefits),
      JSON.stringify(DEFAULT_HOURS),
      JSON.stringify({ rating: STORE.rating, count: STORE.reviewCount }),
      timestamp,
    ],
  );
  return getPostgresPublicPageRow(client, { storeId });
}

async function listPostgresPublicPageAssets(client: PoolClient, pageId: string) {
  const result = await client.query<PublicPageAssetRow>(
    `
      select
        id,
        store_id,
        usage_context,
        original_filename,
        mime_type,
        file_size_bytes,
        storage_url,
        alt_text,
        source,
        created_at::text,
        updated_at::text
      from public_page_assets
      where public_page_id = $1
      order by created_at desc
    `,
    [pageId],
  );
  return result.rows.map(mapPublicPageAsset);
}

async function listPostgresPublicPageTestimonialsForPage(client: PoolClient, pageId: string) {
  const result = await client.query<PublicPageTestimonialRow>(
    `
      select id, name, rating, text, source, status, created_at::text, updated_at::text
      from public_page_testimonials
      where public_page_id = $1
      order by created_at asc
    `,
    [pageId],
  );
  if (result.rows.length > 0) return result.rows.map(mapPublicPageTestimonial);
  return DEFAULT_TESTIMONIALS.map((testimonial, index) => ({
    id: `testimonial-${slugify(testimonial.name || String(index + 1))}`,
    ...testimonial,
    source: testimonial.source || "manual",
    status: testimonial.status || "published",
  }));
}

async function listPostgresPublicPageReviewsForStore(client: PoolClient, storeId: string, includeHidden = false) {
  const result = await client.query<PublicPageReviewRow>(
    `
      select id, name, rating, text, when_label, source, status, created_at::text, updated_at::text
      from public_page_reviews
      where store_id = $1
        and ($2::boolean or status = 'published')
      order by created_at asc
    `,
    [storeId, includeHidden],
  );
  return result.rows.map(mapPublicPageReview);
}

async function listPostgresPublicPagePreviewsForStore(client: PoolClient, storeId: string) {
  const result = await client.query<PublicPagePreviewRow>(
    `
      select id, store_id, generated_at::text, status, preview_url, snapshot
      from public_page_previews
      where store_id = $1
      order by generated_at desc
      limit 10
    `,
    [storeId],
  );
  return result.rows.map(mapPublicPagePreview);
}

async function listPostgresPublicPageJobsForStore(client: PoolClient, storeId: string) {
  const result = await client.query<PublicJobRow>(
    `
      select
        id,
        store_id,
        public_page_id,
        title,
        location,
        employment_type,
        compensation_summary,
        description,
        requirements,
        ideal_gemmatch_mix,
        required_assessment_ids,
        required_course_ids,
        status,
        opened_at::text,
        closed_at::text,
        view_count,
        apply_click_count
      from public_jobs
      where store_id = $1
        and status = 'open'
      order by opened_at desc nulls last, created_at desc
    `,
    [storeId],
  );
  return result.rows.map(mapPostgresPublicJobForBuilder);
}

async function buildPostgresStorePublicPage(client: PoolClient, row: PublicPageConfigRow, includeHiddenReviews = true) {
  const assets = await listPostgresPublicPageAssets(client, row.page_id);
  const testimonials = await listPostgresPublicPageTestimonialsForPage(client, row.page_id);
  const reviews = await listPostgresPublicPageReviewsForStore(client, row.store_id, includeHiddenReviews);
  const previews = await listPostgresPublicPagePreviewsForStore(client, row.store_id);
  const jobs = await listPostgresPublicPageJobsForStore(client, row.store_id);
  const config = mapPublicPageConfig(row, testimonials);
  const logoAsset = assets.find((asset) => asset.id === config.logoAssetId || asset.usageContext === "logo") || null;
  return {
    page: {
      id: row.page_id,
      storeId: row.store_id,
      slug: row.store_slug,
      headline: row.headline,
      about: row.about || "",
      benefits: asStringArray(row.benefits),
      reviewSummary: {
        rating: Number(row.review_summary?.rating ?? 0),
        count: Number(row.review_summary?.count ?? 0),
      },
      status: row.status,
      publishedAt: optional(row.published_at),
      updatedAt: row.updated_at,
    },
    store: {
      ...STORE,
      name: row.store_name,
      location: row.location_label || STORE.location,
      about: row.about || STORE.about,
      benefits: asStringArray(row.benefits).length ? asStringArray(row.benefits) : STORE.benefits,
      rating: Number(row.review_summary?.rating ?? STORE.rating),
      reviewCount: Number(row.review_summary?.count ?? reviews.filter((review) => review.status === "published").length),
      careersUrl: row.store_slug || STORE.careersUrl,
    },
    jobs,
    config,
    assets,
    logoAsset,
    reviews,
    previews,
  };
}

export async function getPostgresStorePublicPage(storeId: string) {
  const client = await getPostgresPool().connect();
  try {
    const page = await ensurePostgresPublicPage(client, storeId);
    if (!page) return undefined;
    return buildPostgresStorePublicPage(client, page);
  } finally {
    client.release();
  }
}

async function replacePostgresPublicPageTestimonials(client: PoolClient, input: { storeId: string; pageId: string; testimonials: PublicPageConfig["testimonials"] }) {
  await client.query("delete from public_page_testimonials where public_page_id = $1", [input.pageId]);
  const timestamp = new Date().toISOString();
  for (const [index, testimonial] of input.testimonials.entries()) {
    const pagePrefix = `${input.pageId}-`;
    const requestedId = testimonial.id?.trim()
      || `testimonial-${slugify(testimonial.name || String(index + 1))}-${index + 1}`;
    const testimonialId = requestedId.startsWith(pagePrefix)
      ? requestedId
      : `${pagePrefix}${requestedId}`;
    await client.query(
      `
        insert into public_page_testimonials (
          id, store_id, public_page_id, name, rating, text, source, status, created_at, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        testimonialId,
        input.storeId,
        input.pageId,
        testimonial.name || "Customer",
        clampRating(testimonial.rating),
        testimonial.text || "",
        testimonial.source || "manual",
        testimonial.status || "published",
        testimonial.createdAt || timestamp,
        timestamp,
      ],
    );
  }
}

export async function savePostgresStorePublicPage(input: { storeId: string; config: PublicPageConfig }) {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const page = await ensurePostgresPublicPage(client, input.storeId);
    if (!page) {
      await client.query("rollback");
      return undefined;
    }
    const timestamp = new Date().toISOString();
    await client.query(
      `
        update store_public_pages
        set
          template_id = $2,
          logo_text = $3,
          logo_asset_id = $4,
          theme = $5::jsonb,
          job_layout = $6,
          headline = $7,
          about = $8,
          hours = $9::jsonb,
          show_reviews = $10,
          status = $11,
          published_at = case when $11 = 'published' then coalesce(published_at, $12) else published_at end,
          updated_at = $12
        where id = $1
      `,
      [
        page.page_id,
        input.config.templateId,
        input.config.logoText,
        input.config.logoAssetId || null,
        JSON.stringify(input.config.theme),
        input.config.jobLayout,
        input.config.headline,
        input.config.about,
        JSON.stringify(input.config.hours || []),
        input.config.showReviews,
        input.config.status,
        timestamp,
      ],
    );
    await replacePostgresPublicPageTestimonials(client, {
      storeId: input.storeId,
      pageId: page.page_id,
      testimonials: input.config.testimonials || [],
    });
    await client.query("commit");
    const updated = await getPostgresPublicPageRow(client, { storeId: input.storeId });
    return updated ? buildPostgresStorePublicPage(client, updated) : undefined;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function publishPostgresStorePublicPage(input: { storeId: string; status: PublicPageConfig["status"] }) {
  const client = await getPostgresPool().connect();
  try {
    const page = await ensurePostgresPublicPage(client, input.storeId);
    if (!page) return undefined;
    const timestamp = new Date().toISOString();
    await client.query(
      `
        update store_public_pages
        set status = $2,
            published_at = case when $2 = 'published' then coalesce(published_at, $3) else published_at end,
            updated_at = $3
        where id = $1
      `,
      [page.page_id, input.status, timestamp],
    );
    const updated = await getPostgresPublicPageRow(client, { storeId: input.storeId });
    return updated ? buildPostgresStorePublicPage(client, updated) : undefined;
  } finally {
    client.release();
  }
}

export async function savePostgresPublicPageLogo(input: {
  storeId: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  url?: string;
  altText?: string;
}) {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const page = await ensurePostgresPublicPage(client, input.storeId);
    if (!page) {
      await client.query("rollback");
      return undefined;
    }
    const timestamp = new Date().toISOString();
    const filename = input.filename?.trim() || `${slugify(page.store_name)}-logo.png`;
    const assetId = id("public-page-logo");
    const assetResult = await client.query<PublicPageAssetRow>(
      `
        insert into public_page_assets (
          id, store_id, public_page_id, usage_context, original_filename, mime_type,
          file_size_bytes, storage_url, alt_text, source, created_at, updated_at
        )
        values ($1, $2, $3, 'logo', $4, $5, $6, $7, $8, $9, $10, $10)
        returning
          id, store_id, usage_context, original_filename, mime_type, file_size_bytes,
          storage_url, alt_text, source, created_at::text, updated_at::text
      `,
      [
        assetId,
        input.storeId,
        page.page_id,
        filename,
        input.mimeType || "image/png",
        Number.isFinite(input.size) ? Number(input.size) : 0,
        input.url || `/mock-assets/${input.storeId}/${filename}`,
        input.altText || `${page.store_name} logo`,
        input.url ? "external_url" : "local_placeholder",
        timestamp,
      ],
    );
    await client.query("update store_public_pages set logo_asset_id = $2, updated_at = $3 where id = $1", [page.page_id, assetId, timestamp]);
    await client.query("commit");
    const updated = await getPostgresPublicPageRow(client, { storeId: input.storeId });
    const updatedPage = updated ? await buildPostgresStorePublicPage(client, updated) : undefined;
    if (!updatedPage) return undefined;
    return {
      asset: mapPublicPageAsset(assetResult.rows[0]),
      page: updatedPage,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listPostgresPublicPageTestimonials(storeId: string) {
  const client = await getPostgresPool().connect();
  try {
    const page = await ensurePostgresPublicPage(client, storeId);
    if (!page) return [];
    return listPostgresPublicPageTestimonialsForPage(client, page.page_id);
  } finally {
    client.release();
  }
}

export async function createPostgresPublicPageTestimonial(input: { storeId: string; name: string; rating?: number; text: string }) {
  const client = await getPostgresPool().connect();
  try {
    const page = await ensurePostgresPublicPage(client, input.storeId);
    if (!page) return undefined;
    const timestamp = new Date().toISOString();
    const result = await client.query<PublicPageTestimonialRow>(
      `
        insert into public_page_testimonials (
          id, store_id, public_page_id, name, rating, text, source, status, created_at, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, 'manual', 'published', $7, $7)
        returning id, name, rating, text, source, status, created_at::text, updated_at::text
      `,
      [id("testimonial"), input.storeId, page.page_id, input.name.trim(), clampRating(input.rating), input.text.trim(), timestamp],
    );
    return result.rows[0] ? mapPublicPageTestimonial(result.rows[0]) : undefined;
  } finally {
    client.release();
  }
}

export async function updatePostgresPublicPageTestimonial(input: {
  storeId: string;
  testimonialId: string;
  name?: string;
  rating?: number;
  text?: string;
  status?: "draft" | "published" | "hidden";
}) {
  const result = await getPostgresPool().query<PublicPageTestimonialRow>(
    `
      update public_page_testimonials
      set
        name = coalesce($3::text, name),
        rating = coalesce($4::integer, rating),
        text = coalesce($5::text, text),
        status = coalesce($6::text, status),
        updated_at = $7
      where store_id = $1
        and id = $2
      returning id, name, rating, text, source, status, created_at::text, updated_at::text
    `,
    [
      input.storeId,
      input.testimonialId,
      input.name?.trim() || null,
      input.rating === undefined ? null : clampRating(input.rating),
      input.text?.trim() || null,
      input.status || null,
      new Date().toISOString(),
    ],
  );
  return result.rows[0] ? mapPublicPageTestimonial(result.rows[0]) : undefined;
}

export async function deletePostgresPublicPageTestimonial(input: { storeId: string; testimonialId: string }) {
  const result = await getPostgresPool().query<PublicPageTestimonialRow>(
    `
      delete from public_page_testimonials
      where store_id = $1
        and id = $2
      returning id, name, rating, text, source, status, created_at::text, updated_at::text
    `,
    [input.storeId, input.testimonialId],
  );
  return result.rows[0] ? mapPublicPageTestimonial(result.rows[0]) : undefined;
}

export async function listPostgresPublicPageReviews(input: { storeId: string; includeHidden?: boolean }) {
  const client = await getPostgresPool().connect();
  try {
    return listPostgresPublicPageReviewsForStore(client, input.storeId, input.includeHidden);
  } finally {
    client.release();
  }
}

export async function updatePostgresPublicPageReview(input: { storeId: string; reviewId: string; status?: "published" | "hidden" }) {
  const result = await getPostgresPool().query<PublicPageReviewRow>(
    `
      update public_page_reviews
      set status = coalesce($3::text, status),
          updated_at = $4
      where store_id = $1
        and id = $2
      returning id, name, rating, text, when_label, source, status, created_at::text, updated_at::text
    `,
    [input.storeId, input.reviewId, input.status || null, new Date().toISOString()],
  );
  return result.rows[0] ? mapPublicPageReview(result.rows[0]) : undefined;
}

export async function createPostgresPublicPagePreview(storeId: string) {
  const client = await getPostgresPool().connect();
  try {
    const page = await ensurePostgresPublicPage(client, storeId);
    if (!page) return undefined;
    const fullPage = await buildPostgresStorePublicPage(client, page);
    const timestamp = new Date().toISOString();
    const snapshot = {
      logoText: fullPage.config.logoText,
      logoUrl: fullPage.config.logoUrl,
      headline: fullPage.config.headline,
      testimonialCount: fullPage.config.testimonials.filter((testimonial) => testimonial.status !== "hidden").length,
      reviewCount: fullPage.reviews.filter((review) => review.status === "published").length,
      jobCount: fullPage.jobs.length,
    };
    const result = await client.query<PublicPagePreviewRow>(
      `
        insert into public_page_previews (
          id, store_id, public_page_id, generated_at, status, preview_url, snapshot
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb)
        returning id, store_id, generated_at::text, status, preview_url, snapshot
      `,
      [id("public-page-preview"), storeId, page.page_id, timestamp, fullPage.config.status, `/api/public/${page.store_slug}?preview=${Date.now().toString(36)}`, JSON.stringify(snapshot)],
    );
    return result.rows[0] ? mapPublicPagePreview(result.rows[0]) : undefined;
  } finally {
    client.release();
  }
}

export async function getPostgresPublishedPublicPage(storeSlug: string) {
  const client = await getPostgresPool().connect();
  try {
    const page = await getPostgresPublicPageRow(client, { slug: storeSlug });
    if (!page || page.status !== "published") return undefined;
    return buildPostgresStorePublicPage(client, page, false);
  } finally {
    client.release();
  }
}

export async function getPostgresPreviewPublicPage(storeSlug: string) {
  const client = await getPostgresPool().connect();
  try {
    const page = await getPostgresPublicPageRow(client, { slug: storeSlug });
    if (!page) return undefined;
    const activeStore = await client.query<{ active: boolean }>(
      "select exists(select 1 from stores where id = $1 and status = 'active') as active",
      [page.store_id],
    );
    if (!activeStore.rows[0]?.active) return undefined;
    return buildPostgresStorePublicPage(client, page, false);
  } finally {
    client.release();
  }
}

export async function recordPostgresPublicCareersEvent(input: {
  storeSlug: string;
  eventType: "page_view" | "application_start";
  jobId?: string;
}) {
  const jobId = input.eventType === "application_start" ? input.jobId || "" : "";
  const result = await getPostgresPool().query<{ event_count: number }>(
    `
      insert into public_careers_daily_events (
        store_id, public_page_id, job_id, event_date, event_type, event_count
      )
      select spp.store_id, spp.id, $3, current_date, $2, 1
      from store_public_pages spp
      join stores s on s.id = spp.store_id
      where spp.slug = $1
        and spp.status = 'published'
        and s.status = 'active'
        and (
          $2 = 'page_view'
          or exists (
            select 1 from public_jobs pj
            where pj.id = $3 and pj.store_id = spp.store_id and pj.status = 'open'
          )
        )
      on conflict (public_page_id, job_id, event_date, event_type)
      do update set event_count = public_careers_daily_events.event_count + 1
      returning event_count
    `,
    [input.storeSlug, input.eventType, jobId],
  );
  return Boolean(result.rows[0]);
}

async function queryPostgresAdminCompanyRows(client: PoolClient, query = "") {
  const normalized = query.trim().toLowerCase();
  const result = await client.query<AdminCompanyRow>(
    `
      select
        c.id,
        c.name,
        c.owner_name,
        c.plan_tier,
        c.status,
        c.created_at::text,
        count(distinct s.id)::text as stores_count,
        count(distinct su.user_id)::text as seats_count,
        count(distinct ji.id)::text as assessments_sent,
        count(distinct hired.id)::text as hires_count
      from companies c
      left join stores s on s.company_id = c.id
      left join store_users su on su.store_id = s.id and su.status <> 'inactive'
      left join jewelcert_invites ji on ji.store_id = s.id
      left join applications hired on hired.store_id = s.id and hired.stage = 'hired'
      where (
        $1::text = ''
        or lower(c.name) like '%' || $1 || '%'
        or lower(coalesce(c.owner_name, '')) like '%' || $1 || '%'
      )
      group by c.id
      order by c.updated_at desc, c.name asc
    `,
    [normalized],
  );
  return result.rows;
}

async function queryPostgresAdminStores(client: PoolClient, companyIds: string[]) {
  if (companyIds.length === 0) return new Map<string, AdminStoreRow[]>();
  const result = await client.query<AdminStoreRow>(
    `
      select id, company_id, name, location_label
      from stores
      where company_id = any($1::text[])
      order by name asc
    `,
    [companyIds],
  );
  const byCompanyId = new Map<string, AdminStoreRow[]>();
  for (const row of result.rows) {
    byCompanyId.set(row.company_id, [...(byCompanyId.get(row.company_id) || []), row]);
  }
  return byCompanyId;
}

async function queryPostgresAdminUsers(client: PoolClient, companyIds: string[]) {
  if (companyIds.length === 0) return new Map<string, AdminCompanyUserRow[]>();
  const result = await client.query<AdminCompanyUserRow>(
    `
      select distinct
        u.id,
        coalesce(u.company_id, s.company_id) as company_id,
        u.name,
        u.email,
        coalesce(su.role, 'supervisor') as role,
        u.status
      from users u
      left join store_users su on su.user_id = u.id
      left join stores s on s.id = su.store_id
      where (
          u.company_id = any($1::text[])
          or s.company_id = any($1::text[])
        )
        and u.status <> 'inactive'
      order by u.name asc
    `,
    [companyIds],
  );
  const byCompanyId = new Map<string, AdminCompanyUserRow[]>();
  for (const row of result.rows) {
    const companyId = row.company_id || companyIds[0];
    byCompanyId.set(companyId, [...(byCompanyId.get(companyId) || []), row]);
  }
  return byCompanyId;
}

async function listPostgresAdminCompaniesWithClient(client: PoolClient, query = "") {
  const rows = await queryPostgresAdminCompanyRows(client, query);
  const companyIds = rows.map((row) => row.id);
  const stores = await queryPostgresAdminStores(client, companyIds);
  const users = await queryPostgresAdminUsers(client, companyIds);
  return rows.map((row) => mapAdminCompany(row, stores.get(row.id) || [], users.get(row.id) || []));
}

export async function listPostgresAdminCompanies(query = "") {
  const client = await getPostgresPool().connect();
  try {
    return await listPostgresAdminCompaniesWithClient(client, query);
  } finally {
    client.release();
  }
}

export async function getPostgresAdminCompany(companyId: string) {
  const companies = await listPostgresAdminCompanies();
  return companies.find((company) => company.id === companyId);
}

export async function listPostgresAdminAuditLog() {
  const result = await getPostgresPool().query<AdminAuditRow>(
    `
      select
        id,
        actor_label,
        action,
        target_label,
        metadata,
        created_at::text
      from admin_audit_entries
      order by created_at desc
      limit 50
    `,
  );
  return result.rows.map(mapAdminAuditEntry);
}

export async function getPostgresAdminOverview() {
  const companies = await listPostgresAdminCompanies();
  const metrics = adminMetricsForPostgres(companies);
  const auditLog = await listPostgresAdminAuditLog();
  return {
    metrics,
    recentCompanies: companies.slice(0, 4),
    auditLog: auditLog.slice(0, 5),
  };
}

export async function getPostgresAdminBilling() {
  const client = await getPostgresPool().connect();
  try {
    const companies = await listPostgresAdminCompaniesWithClient(client);
    const planResult = await client.query<BillingPlanRow>(
      `
        select id, tier, price_cents, billing_interval, seats_label, features, status
        from billing_plans
        where status = 'active'
        order by price_cents asc
      `,
    );
    const invoiceResult = await client.query<AdminInvoiceRow>(
      `
        select i.id, c.name as company_name, i.amount_cents, i.status, i.issued_at::text
        from invoices i
        join companies c on c.id = i.company_id
        order by i.issued_at desc
        limit 20
      `,
    );
    const mrrResult = await client.query<{ mrr_cents: string }>(
      `select coalesce(sum(
         case
           when entitlement.source = 'stripe'
             and entitlement.status = 'active'
             and (entitlement.expires_at is null or entitlement.expires_at > now())
           then
             case when coalesce(entitlement.billing_interval, plan.billing_interval) = 'year'
               then coalesce(entitlement.amount_cents, plan.price_cents, 0)::numeric / 12
               else coalesce(entitlement.amount_cents, plan.price_cents, 0)::numeric
             end
           when entitlement.company_id is null
             and subscription.provider = 'stripe'
             and subscription.status in ('active', 'trialing')
             and (subscription.current_period_end is null or subscription.current_period_end > now())
           then
             case when plan.billing_interval = 'year'
               then coalesce(plan.price_cents, 0)::numeric / 12
               else coalesce(plan.price_cents, 0)::numeric
             end
           else 0
         end
       ), 0)::text as mrr_cents
       from companies company
       left join company_access_entitlements entitlement on entitlement.company_id = company.id
       left join subscriptions subscription on subscription.company_id = company.id
       left join billing_plans plan on plan.id = subscription.plan_id
       where company.status in ('active', 'trialing')`,
    );
    const mrr = Number(mrrResult.rows[0]?.mrr_cents || 0) / 100;
    const byPlan = (["Starter", "Growth", "Pro"] as PlanTier[]).map((tier) => ({
      tier,
      count: companies.filter((company) => company.plan === tier).length,
    }));
    return {
      mrr,
      byPlan,
      plans: planResult.rows.length > 0 ? planResult.rows.map(mapBillingPlan) : PLANS.map((plan) => ({ ...plan, features: [...plan.features] })),
      invoices: invoiceResult.rows.length > 0 ? invoiceResult.rows.map(mapAdminInvoice) : INVOICES.map((invoice) => ({ ...invoice })),
    };
  } finally {
    client.release();
  }
}

export async function getPostgresAdminAnalytics() {
  const companies = await listPostgresAdminCompanies();
  const metrics = adminMetricsForPostgres(companies);
  const maxSent = Math.max(...companies.map((company) => company.assessmentsSent), 1);
  return {
    metrics,
    funnel: [
      { key: "Assessments sent", value: metrics.assessmentsSent },
      { key: "Completed", value: Math.round(metrics.assessmentsSent * 0.78) },
      { key: "Interviewed", value: Math.round(metrics.assessmentsSent * 0.31) },
      { key: "Hired", value: metrics.hires },
    ],
    fitDistribution: [
      { key: "Strong fit", value: 38 },
      { key: "Good fit", value: 41 },
      { key: "Stretch", value: 15 },
      { key: "Poor fit", value: 6 },
    ],
    assessmentsByCompany: companies.map((company) => ({
      companyId: company.id,
      name: company.name,
      value: company.assessmentsSent,
      pctOfMax: Math.round((company.assessmentsSent / maxSent) * 100),
    })),
    adoptionByPlan: (["Starter", "Growth", "Pro"] as PlanTier[]).map((tier) => ({
      tier,
      count: companies.filter((company) => company.plan === tier).length,
    })),
  };
}

export async function getPostgresAdminSupport(query = "") {
  return {
    companies: await listPostgresAdminCompanies(query),
    auditLog: await listPostgresAdminAuditLog(),
  };
}

export async function listPostgresStoreGemMatchInvites(storeId: string, status?: string | null) {
  const result = await getPostgresPool().query<GemMatchInviteListRow>(
    `
      select
        gi.id,
        gi.application_id,
        gi.store_id,
        gi.sent_by_user_id,
        gi.status,
        gi.result_profile_code,
        gi.fit_rating,
        gi.result_mix,
        gi.fit_score,
        gi.created_at::text,
        gi.completed_at::text,
        ap.id as applicant_profile_id,
        ap.full_name as applicant_full_name,
        ap.email as applicant_email,
        ap.resume_headline as applicant_resume_headline,
        pj.title as job_title
      from gemmatch_invites gi
      left join applications a on a.id = gi.application_id
      left join applicant_profiles ap on ap.id = a.applicant_profile_id
      left join public_jobs pj on pj.id = a.job_id
      where gi.store_id = $1
        and ($2::text is null or gi.status = $2)
      order by gi.created_at desc
    `,
    [storeId, status?.trim().toLowerCase() || null],
  );
  return result.rows.map(mapGemMatchInviteListItem);
}

function resolveGemMatchPickedTexts(pickedAdjectiveIds?: string[]) {
  return (pickedAdjectiveIds || [])
    .map((rawId) => {
      const normalized = slugify(String(rawId));
      return ADJECTIVES.find((adjective) => slugify(adjective.text) === normalized || adjective.text === rawId)?.text;
    })
    .filter((text): text is string => Boolean(text));
}

export async function completePostgresGemMatchResponse(input: { inviteId: string; pickedAdjectiveIds?: string[] }) {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    let inviteResult = await client.query<GemMatchInviteRow>(
      `
        select
          id, application_id, store_id, sent_by_user_id, status, result_profile_code, fit_rating,
          created_at::text, completed_at::text
        from gemmatch_invites
        where id = $1
        for update
      `,
      [input.inviteId],
    );
    let invite = inviteResult.rows[0];

    const jewelcertResult = await client.query<JewelCertInviteRow>(
      `
        select
          id, application_id, store_id, assessment_package_id, sent_by_user_id, sent_to_email,
          status, expires_at::text, sent_at::text, completed_at::text
        from jewelcert_invites
        where id = $1
        for update
      `,
      [input.inviteId],
    );
    const directJewelCert = jewelcertResult.rows[0];

    if (!invite && directJewelCert) {
      inviteResult = await client.query<GemMatchInviteRow>(
        `
          select
            id, application_id, store_id, sent_by_user_id, status, result_profile_code, fit_rating,
            created_at::text, completed_at::text
          from gemmatch_invites
          where application_id = $1
          order by created_at desc
          limit 1
          for update
        `,
        [directJewelCert.application_id],
      );
      invite = inviteResult.rows[0];
      if (!invite) {
        const timestamp = new Date().toISOString();
        const newInviteResult = await client.query<GemMatchInviteRow>(
          `
            insert into gemmatch_invites (
              id, application_id, store_id, sent_by_user_id, status, created_at
            )
            values ($1, $2, $3, $4, 'started', $5)
            returning
              id, application_id, store_id, sent_by_user_id, status, result_profile_code, fit_rating,
              created_at::text, completed_at::text
          `,
          [id("gemmatch"), directJewelCert.application_id, directJewelCert.store_id, directJewelCert.sent_by_user_id, timestamp],
        );
        invite = newInviteResult.rows[0];
      }
    }

    if (!invite) {
      await client.query("rollback");
      return undefined;
    }

    const applicationResult = await client.query<{
      company_id: string;
      stage: ApplicationStage;
      source: ApplicationRecord["source"];
    }>(
      `
        select s.company_id, a.stage, a.source
        from applications a
        join stores s on s.id = a.store_id
        where a.id = $1
          and a.store_id = $2
        for update
      `,
      [invite.application_id, invite.store_id],
    );
    const application = applicationResult.rows[0];
    if (!application) {
      await client.query("rollback");
      return undefined;
    }

    const pickedTexts = resolveGemMatchPickedTexts(input.pickedAdjectiveIds);
    // Fall back to Foundation when no picks resolve (empty/legacy submissions),
    // matching the local runtime (completeGemMatchResponse). Without this guard
    // scoreGemMatch([]) returns "V" (stable-sort of an all-zero mix), which would
    // diverge from local's "F" fallback for the same empty submission.
    const scored = pickedTexts.length ? scoreGemMatch(pickedTexts) : null;
    const primary: ProfileCode = scored?.primary ?? "F";
    // The candidate's REAL trait mix — persisted so managers see the actual
    // distribution, not a canned one reconstructed from just the primary letter.
    const resultMix: Mix = scored?.mix ?? { V: 0, C: 0, F: 0, D: 0 };
    // Job-aware fit: score the candidate's mix against the job's ideal traits
    // (idealGemMatchMix) instead of the old hardcode keyed only on the primary.
    const idealRow = await client.query<{ ideal_gemmatch_mix: JsonArray | null }>(
      `select pj.ideal_gemmatch_mix from applications a left join public_jobs pj on pj.id = a.job_id where a.id = $1`,
      [invite.application_id],
    );
    const idealMix = (idealRow.rows[0]?.ideal_gemmatch_mix as ProfileCode[] | null) || null;
    const { fitScore, tier: fitRating } = fitFor(resultMix, idealMix);
    const timestamp = new Date().toISOString();
    const stageEventId = id("event");
    const domainEventId = id("event");
    // Capture the pre-update completion state so the caller can fire the
    // "assessment completed" emails only on the genuine started->completed
    // transition. A repeat POST for an already-completed invite must not
    // re-notify the candidate + manager (mirrors the hire route's guard).
    const wasAlreadyCompleted = invite.status === "completed";

    const updatedInvite = await client.query<GemMatchInviteRow>(
      `
        update gemmatch_invites
        set status = 'completed',
            result_profile_code = $1,
            fit_rating = $2,
            result_mix = $3::jsonb,
            fit_score = $4,
            completed_at = $5
        where id = $6
        returning
          id, application_id, store_id, sent_by_user_id, status, result_profile_code, fit_rating,
          created_at::text, completed_at::text
      `,
      [primary, fitRating, JSON.stringify(resultMix), fitScore, timestamp, invite.id],
    );

    // Completing the pick-10 profile is not the same as completing the whole JewelCert
    // package. JewelCert completion needs real assessment-attempt evidence,
    // not a shortcut from the package invite id.
    await reconcilePostgresJewelCertCompletionWithClient(client, { applicationId: invite.application_id ?? undefined });

    if (application.source === "jewellink_employee") {
      await client.query(
        `
          update applications
          set status_reason = 'Completed JewelLink employee JewelCert',
              last_activity_at = $1,
              updated_at = $1
          where id = $2
            and store_id = $3
        `,
        [timestamp, invite.application_id, invite.store_id],
      );
    } else {
      await client.query(
        `
          update applications
          set stage = 'gemmatch',
              status_reason = 'Completed JewelCert response',
              last_activity_at = $1,
              updated_at = $1
          where id = $2
            and store_id = $3
        `,
        [timestamp, invite.application_id, invite.store_id],
      );
      await client.query(
        `
          insert into application_stage_events (
            id, application_id, store_id, from_stage, to_stage, actor_user_id, reason, metadata, created_at
          )
          values ($1, $2, $3, $4, 'gemmatch', $5, 'Completed JewelCert response', $6::jsonb, $7)
        `,
        [
          stageEventId,
          invite.application_id,
          invite.store_id,
          application.stage,
          invite.sent_by_user_id,
          JSON.stringify({ gemmatchInviteId: invite.id, pickedCount: pickedTexts.length }),
          timestamp,
        ],
      );
    }
    await client.query(
      `
        insert into domain_events (
          id, store_id, company_id, actor_user_id, event_type, subject_type, subject_id, payload, created_at
        )
        values ($1, $2, $3, $4, 'gemmatch.completed', 'gemmatch_invite', $5, $6::jsonb, $7)
      `,
      [
        domainEventId,
        invite.store_id,
        application.company_id,
        invite.sent_by_user_id,
        invite.id,
        JSON.stringify({ applicationId: invite.application_id, primary, fitRating, pickedCount: pickedTexts.length }),
        timestamp,
      ],
    );

    await client.query("commit");
    return {
      invite: updatedInvite.rows[0] ? mapGemMatchInvite(updatedInvite.rows[0]) : undefined,
      result: { primary, fitRating },
      wasAlreadyCompleted,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getPostgresGemMatchInviteScope(inviteId: string) {
  const result = await getPostgresPool().query<{
    store_id: string;
    recipient_email: string | null;
    application_source: string;
    external_user_id: string | null;
    resource_location: string | null;
  }>(
    `
      select gi.store_id, ap.email as recipient_email, a.source as application_source,
             (
               select external_invite.external_user_id
               from jewelcert_invites external_invite
               where external_invite.application_id = a.id
                 and external_invite.external_user_id is not null
               order by external_invite.created_at desc, external_invite.id desc
               limit 1
             ) as external_user_id,
             resource_location.location_id as resource_location
      from gemmatch_invites gi
      join applications a on a.id = gi.application_id
      join applicant_profiles ap on ap.id = a.applicant_profile_id
      left join public_jobs pj on pj.id = a.job_id
      ${resolvedJobLocationJoin("pj.location", "a.store_id", "resource_location")}
      where gi.id = $1
      union all
      select ji.store_id, coalesce(ap.email, ji.sent_to_email) as recipient_email,
             a.source as application_source, ji.external_user_id,
             resource_location.location_id as resource_location
      from jewelcert_invites ji
      join applications a on a.id = ji.application_id
      join applicant_profiles ap on ap.id = a.applicant_profile_id
      left join public_jobs pj on pj.id = a.job_id
      ${resolvedJobLocationJoin("pj.location", "a.store_id", "resource_location")}
      where ji.id = $1
      limit 1
    `,
    [inviteId],
  );
  const row = result.rows[0];
  return row ? {
    storeId: row.store_id,
    recipientEmail: row.recipient_email || undefined,
    externalUserId: row.external_user_id || undefined,
    applicationSource: row.application_source,
    resourceLocation: row.resource_location || undefined,
  } : undefined;
}

export async function getPostgresGemMatchCompletionNotificationContext(inviteId: string) {
  const result = await getPostgresPool().query<{
    application_id: string;
    store_id: string;
    candidate_name: string;
    candidate_email: string;
    job_title: string | null;
    manager_name: string | null;
    manager_email: string | null;
  }>(
    `
      select
        a.id as application_id,
        a.store_id,
        ap.full_name as candidate_name,
        ap.email as candidate_email,
        pj.title as job_title,
        manager.name as manager_name,
        manager.email as manager_email
      from gemmatch_invites gi
      join applications a on a.id = gi.application_id
      join applicant_profiles ap on ap.id = a.applicant_profile_id
      left join public_jobs pj on pj.id = a.job_id
      left join lateral (
        select u.name, u.email
        from store_users su
        join users u on u.id = su.user_id
        where su.store_id = gi.store_id
          and su.status = 'active'
          and su.role in ('admin', 'store_owner')
          and u.status = 'active'
        order by case when u.id = gi.sent_by_user_id then 0 else 1 end, su.created_at asc
        limit 1
      ) manager on true
      where gi.id = $1
      limit 1
    `,
    [inviteId],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    applicationId: row.application_id,
    storeId: row.store_id,
    candidateName: row.candidate_name,
    candidateEmail: row.candidate_email,
    jobTitle: row.job_title || undefined,
    managerName: row.manager_name || undefined,
    managerEmail: row.manager_email || undefined,
  };
}

export async function getPostgresStoreManagerNotificationContact(storeId: string) {
  const result = await getPostgresPool().query<{
    name: string | null;
    email: string | null;
  }>(
    `
      select u.name, u.email
      from store_users su
      join users u on u.id = su.user_id
      where su.store_id = $1
        and su.status = 'active'
        and su.role in ('admin', 'store_owner')
        and u.status = 'active'
        and u.email <> ''
      order by
        case su.role when 'store_owner' then 0 when 'admin' then 1 else 2 end,
        su.created_at asc,
        u.name asc
      limit 1
    `,
    [storeId],
  );
  const row = result.rows[0];
  return row ? { name: row.name || undefined, email: row.email || undefined } : undefined;
}

async function createPostgresAdminAuditEntry(
  client: PoolClient,
  input: {
    actorLabel?: string;
    action: string;
    targetType: string;
    targetId: string;
    targetLabel: string;
    metadata?: Record<string, string>;
  },
) {
  const timestamp = new Date().toISOString();
  const result = await client.query<AdminAuditRow>(
    `
      insert into admin_audit_entries (
        id, actor_label, action, target_type, target_id, target_label, metadata, created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      returning id, actor_label, action, target_label, metadata, created_at::text
    `,
    [
      id("admin-audit"),
      input.actorLabel || "you",
      input.action,
      input.targetType,
      input.targetId,
      input.targetLabel,
      JSON.stringify(input.metadata || {}),
      timestamp,
    ],
  );
  return mapAdminAuditEntry(result.rows[0]);
}

async function queryPostgresAdminCompanyById(client: PoolClient, companyId: string) {
  const rows = await queryPostgresAdminCompanyRows(client);
  const companyRow = rows.find((row) => row.id === companyId);
  if (!companyRow) return undefined;
  const stores = await queryPostgresAdminStores(client, [companyId]);
  const users = await queryPostgresAdminUsers(client, [companyId]);
  return mapAdminCompany(companyRow, stores.get(companyId) || [], users.get(companyId) || []);
}

async function uniqueCompanySlug(client: PoolClient, value: string) {
  const base = slugify(value) || "company";
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const result = await client.query<{ exists: boolean }>(
      `
        select exists(
          select 1 from stores where slug = $1
          union all
          select 1 from companies where id = $2
        ) as exists
      `,
      [`${slug}-careers`, `co-${slug}`],
    );
    if (!result.rows[0]?.exists) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createPostgresAdminCompany(input: { name: string; owner: string; plan: PlanTier; ownerEmail?: string }) {
  const client = await getPostgresPool().connect();
  const timestamp = new Date().toISOString();
  const name = input.name.trim();
  const owner = input.owner.trim();
  try {
    await client.query("begin");
    const slugBase = await uniqueCompanySlug(client, name);
    const ownerEmail = input.ownerEmail?.trim() || `${slugBase}-owner@example.invalid`;
    const ownerEmailNormalized = normalizeEmail(ownerEmail);
    const companyId = `co-${slugBase}`;
    const storeId = `store-${slugBase}-primary`;
    const userId = `user-${slugBase}-owner`;
    const planDb = labelPlanToDb(input.plan);
    await client.query(
      `
        insert into companies (id, name, owner_name, plan_tier, status, created_at, updated_at)
        values ($1, $2, $3, $4, 'trialing', $5, $5)
      `,
      [companyId, name, owner, planDb, timestamp],
    );
    await client.query(
      `
        insert into stores (id, company_id, name, slug, location_label, timezone, status, created_at, updated_at)
        values ($1, $2, $3, $4, null, 'America/New_York', 'active', $5, $5)
      `,
      [storeId, companyId, `${name} - Primary`, `${slugBase}-careers`, timestamp],
    );
    await client.query(
      `
        insert into users (id, company_id, email, email_normalized, name, status, created_at, updated_at)
        values ($1, $2, $3, $4, $5, 'invited', $6, $6)
      `,
      [userId, companyId, ownerEmail, ownerEmailNormalized, owner, timestamp],
    );
    await client.query(
      `
        insert into store_users (id, store_id, user_id, role, status, created_at, updated_at)
        values ($1, $2, $3, 'admin', 'invited', $4, $4)
      `,
      [`store-user-${slugBase}-owner`, storeId, userId, timestamp],
    );
    await client.query(
      `
        insert into subscriptions (
          id, company_id, plan_id, status, current_period_start, current_period_end, provider,
          provider_subscription_id, created_at, updated_at
        )
        values ($1, $2, $3, 'trialing', $4, $5, 'manual', $6, $4, $4)
        on conflict (company_id) do update set
          plan_id = excluded.plan_id,
          status = excluded.status,
          current_period_start = excluded.current_period_start,
          current_period_end = excluded.current_period_end,
          updated_at = excluded.updated_at
      `,
      [
        `sub-${slugBase}-${planDb}`,
        companyId,
        `plan-${planDb}`,
        timestamp,
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        `manual-sub-${slugBase}-${planDb}`,
      ],
    );
    await createPostgresAdminAuditEntry(client, {
      action: "Created company",
      targetType: "company",
      targetId: companyId,
      targetLabel: name,
      metadata: { companyId, plan: input.plan },
    });
    const company = await queryPostgresAdminCompanyById(client, companyId);
    if (!company) throw new Error("Created company could not be read back from Postgres");
    await client.query("commit");
    return company;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePostgresAdminCompany(input: { companyId: string; plan?: PlanTier; status?: CompanyStatus }) {
  const client = await getPostgresPool().connect();
  const timestamp = new Date().toISOString();
  try {
    await client.query("begin");
    const current = await client.query<{ id: string; name: string }>("select id, name from companies where id = $1", [input.companyId]);
    if (!current.rows[0]) {
      await client.query("rollback");
      return undefined;
    }
    const planDb = input.plan ? labelPlanToDb(input.plan) : undefined;
    const statusDb = labelCompanyStatusToDb(input.status);
    await client.query(
      `
        update companies
        set plan_tier = coalesce($2::text, plan_tier),
            status = coalesce($3::text, status),
            updated_at = $4
        where id = $1
      `,
      [input.companyId, planDb || null, statusDb || null, timestamp],
    );
    if (planDb || input.status) {
      await client.query(
        `
          update subscriptions
          set plan_id = coalesce($2::text, plan_id),
              status = coalesce($3::text, status),
              updated_at = $4
          where company_id = $1
        `,
        [input.companyId, planDb ? `plan-${planDb}` : null, labelCompanyStatusToSubscriptionDb(input.status) || null, timestamp],
      );
    }
    await createPostgresAdminAuditEntry(client, {
      action: "Updated company",
      targetType: "company",
      targetId: input.companyId,
      targetLabel: current.rows[0].name,
      metadata: {
        companyId: input.companyId,
        ...(input.plan ? { plan: input.plan } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
    });
    const company = await queryPostgresAdminCompanyById(client, input.companyId);
    await client.query("commit");
    return company;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function removePostgresAdminCompany(companyId: string) {
  if (PROTECTED_ADMIN_COMPANY_IDS.has(companyId)) return undefined;
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const company = await queryPostgresAdminCompanyById(client, companyId);
    if (!company) {
      await client.query("rollback");
      return undefined;
    }
    const userResult = await client.query<{ id: string }>("select id from users where company_id = $1", [companyId]);
    await client.query("delete from users where company_id = $1", [companyId]);
    await client.query("delete from companies where id = $1", [companyId]);
    await createPostgresAdminAuditEntry(client, {
      action: "Deleted company",
      targetType: "company",
      targetId: companyId,
      targetLabel: company.name,
      metadata: { companyId, deletedUserCount: String(userResult.rowCount || 0) },
    });
    await client.query("commit");
    return { company, deleted: true };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function invitePostgresAdminCompanyUser(input: { companyId: string; name: string; email: string; role?: AdminCompanyUser["role"] }) {
  const client = await getPostgresPool().connect();
  const timestamp = new Date().toISOString();
  const email = input.email.trim();
  const emailNormalized = normalizeEmail(email);
  const userId = id("user");
  const roleDb = labelAdminRoleToDb(input.role);
  try {
    await client.query("begin");
    const company = await client.query<{ id: string; name: string }>("select id, name from companies where id = $1", [input.companyId]);
    if (!company.rows[0]) {
      await client.query("rollback");
      return undefined;
    }
    const userResult = await client.query<{ id: string }>(
      `
        insert into users (id, company_id, email, email_normalized, name, status, created_at, updated_at)
        values ($1, $2, $3, $4, $5, 'invited', $6, $6)
        on conflict (email_normalized) do update set
          company_id = excluded.company_id,
          email = excluded.email,
          name = excluded.name,
          status = 'invited',
          updated_at = excluded.updated_at
        returning id
      `,
      [userId, input.companyId, email, emailNormalized, input.name.trim(), timestamp],
    );
    const resolvedUserId = userResult.rows[0].id;
    const stores = await client.query<{ id: string }>("select id from stores where company_id = $1", [input.companyId]);
    for (const store of stores.rows) {
      await client.query(
        `
          insert into store_users (id, store_id, user_id, role, status, created_at, updated_at)
          values ($1, $2, $3, $4, 'invited', $5, $5)
          on conflict (store_id, user_id) do update set
            role = excluded.role,
            status = 'invited',
            updated_at = excluded.updated_at
        `,
        [id("store-user"), store.id, resolvedUserId, roleDb, timestamp],
      );
    }
    await createPostgresAdminAuditEntry(client, {
      action: "Invited user",
      targetType: "user",
      targetId: resolvedUserId,
      targetLabel: `${email} at ${company.rows[0].name}`,
      metadata: { companyId: input.companyId, userId: resolvedUserId },
    });
    const nextCompany = await queryPostgresAdminCompanyById(client, input.companyId);
    const user = nextCompany?.users.find((item) => item.id === resolvedUserId);
    await client.query("commit");
    return nextCompany && user ? { company: nextCompany, user } : undefined;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePostgresAdminUser(input: { userId: string; role?: AdminCompanyUser["role"]; status?: AdminCompanyUser["status"] }) {
  const client = await getPostgresPool().connect();
  const timestamp = new Date().toISOString();
  try {
    await client.query("begin");
    const userResult = await client.query<{ id: string; company_id: string; email: string; name: string }>(
      "select id, company_id, email, name from users where id = $1 and status <> 'inactive'",
      [input.userId],
    );
    const userRow = userResult.rows[0];
    if (!userRow?.company_id) {
      await client.query("rollback");
      return undefined;
    }
    const statusDb = labelAdminUserStatusToDb(input.status);
    await client.query(
      `
        update users
        set status = coalesce($2::text, status),
            updated_at = $3
        where id = $1
      `,
      [input.userId, statusDb || null, timestamp],
    );
    await client.query(
      `
        update store_users
        set role = coalesce($2::text, role),
            status = coalesce($3::text, status),
            updated_at = $4
        where user_id = $1
      `,
      [input.userId, input.role ? labelAdminRoleToDb(input.role) : null, statusDb || null, timestamp],
    );
    await createPostgresAdminAuditEntry(client, {
      action: "Updated user",
      targetType: "user",
      targetId: input.userId,
      targetLabel: userRow.email,
      metadata: {
        companyId: userRow.company_id,
        userId: input.userId,
        ...(input.role ? { role: input.role } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
    });
    const company = await queryPostgresAdminCompanyById(client, userRow.company_id);
    const user = company?.users.find((item) => item.id === input.userId);
    await client.query("commit");
    return company && user ? { company, user } : undefined;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function removePostgresAdminUser(userId: string) {
  const client = await getPostgresPool().connect();
  const timestamp = new Date().toISOString();
  try {
    await client.query("begin");
    const roleResult = await client.query<{ company_id: string; email: string; name: string; is_admin: boolean }>(
      `
        select
          u.company_id,
          u.email,
          u.name,
          coalesce(bool_or(su.role in ('admin', 'store_owner')), false) as is_admin
        from users u
        left join store_users su on su.user_id = u.id and su.status <> 'inactive'
        where u.id = $1 and u.status <> 'inactive'
        group by u.id
      `,
      [userId],
    );
    const userRow = roleResult.rows[0];
    if (!userRow?.company_id || userRow.is_admin) {
      await client.query("rollback");
      return undefined;
    }
    const removedUser: AdminCompanyUser = {
      id: userId,
      name: userRow.name,
      email: userRow.email,
      role: "Supervisor",
      status: "Active",
    };
    await client.query("update users set status = 'inactive', updated_at = $2 where id = $1", [userId, timestamp]);
    await client.query("update store_users set status = 'inactive', updated_at = $2 where user_id = $1", [userId, timestamp]);
    await createPostgresAdminAuditEntry(client, {
      action: "Removed user",
      targetType: "user",
      targetId: userId,
      targetLabel: userRow.email,
      metadata: { companyId: userRow.company_id, userId },
    });
    const company = await queryPostgresAdminCompanyById(client, userRow.company_id);
    await client.query("commit");
    return company ? { company, user: removedUser } : undefined;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function resendPostgresAdminUserInvite(userId: string) {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const userResult = await client.query<{ id: string; company_id: string; email: string; name: string; status: string; is_admin: boolean }>(
      `
        select
          u.id,
          u.company_id,
          u.email,
          u.name,
          u.status,
          coalesce(bool_or(su.role in ('admin', 'store_owner')), false) as is_admin
        from users u
        left join store_users su on su.user_id = u.id and su.status <> 'inactive'
        where u.id = $1 and u.status <> 'inactive'
        group by u.id
      `,
      [userId],
    );
    const userRow = userResult.rows[0];
    if (!userRow?.company_id) {
      await client.query("rollback");
      return undefined;
    }
    await createPostgresAdminAuditEntry(client, {
      action: "Resent invite",
      targetType: "user",
      targetId: userId,
      targetLabel: userRow.email,
      metadata: { companyId: userRow.company_id, userId },
    });
    const company = await queryPostgresAdminCompanyById(client, userRow.company_id);
    const user = company?.users.find((item) => item.id === userId) || {
      id: userId,
      name: userRow.name,
      email: userRow.email,
      role: userRow.is_admin ? "Admin" : "Supervisor",
      status: userRow.status === "active" ? "Active" : "Invited",
    };
    await client.query("commit");
    return company ? { company, user } : undefined;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function startPostgresAdminImpersonation(companyId: string) {
  const client = await getPostgresPool().connect();
  const timestamp = new Date().toISOString();
  try {
    await client.query("begin");
    const company = await queryPostgresAdminCompanyById(client, companyId);
    if (!company) {
      await client.query("rollback");
      return undefined;
    }
    const storeResult = await client.query<{ id: string }>(
      "select id from stores where company_id = $1 order by created_at asc, name asc limit 1",
      [companyId],
    );
    const audit = await createPostgresAdminAuditEntry(client, {
      action: "Viewed as",
      targetType: "company",
      targetId: companyId,
      targetLabel: company.name,
      metadata: { companyId },
    });
    const sessionId = id("imp");
    await client.query(
      `
        insert into impersonation_sessions (
          id, company_id, store_id, reason, started_at, audit_entry_id
        )
        values ($1, $2, $3, 'admin_view_as', $4, $5)
      `,
      [sessionId, companyId, storeResult.rows[0]?.id || null, timestamp, audit.id],
    );
    await client.query("commit");
    return {
      company,
      session: {
        id: sessionId,
        mode: "view_as",
        startedAt: timestamp,
        auditId: audit.id,
      },
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function queryPostgresStoreUsers(client: PoolClient, storeId: string) {
  const result = await client.query<StoreUserRow>(
    `
      select
        u.id,
        su.store_id,
        s.company_id,
        u.name,
        u.email,
        su.role,
        su.status
      from store_users su
      join users u on u.id = su.user_id
      join stores s on s.id = su.store_id
      where su.store_id = $1
        and su.status <> 'inactive'
      order by
        case su.role
          when 'store_owner' then 0
          when 'admin' then 0
          when 'manager' then 1
          else 2
        end,
        u.name asc
    `,
    [storeId],
  );
  return result.rows;
}

async function queryPostgresStoreSettings(client: PoolClient, storeId: string) {
  const result = await client.query<StoreSettingsRow>(
    `
      select
        s.id as store_id,
        s.company_id,
        coalesce(ss.organization_company, c.name) as organization_company,
        coalesce(ss.organization_primary_store, s.location_label, s.name) as organization_primary_store,
        coalesce(ss.default_manager, owner_user.name, '') as default_manager,
        coalesce(ss.workflow, '[]'::jsonb) as workflow,
        coalesce(ss.notifications, '[]'::jsonb) as notifications,
        coalesce(ss.updated_at, s.updated_at)::text as updated_at
      from stores s
      join companies c on c.id = s.company_id
      left join store_settings ss on ss.store_id = s.id
      left join lateral (
        select u.name
        from store_users su
        join users u on u.id = su.user_id
        where su.store_id = s.id
          and su.status <> 'inactive'
        order by
          case su.role when 'store_owner' then 0 when 'admin' then 0 when 'manager' then 1 else 2 end,
          su.updated_at desc
        limit 1
      ) owner_user on true
      where s.id = $1
      limit 1
    `,
    [storeId],
  );
  return result.rows[0];
}

export async function getPostgresStoreSettings(storeId: string) {
  const client = await getPostgresPool().connect();
  try {
    const row = await queryPostgresStoreSettings(client, storeId);
    return row
      ? mapStoreSettings(row)
      : {
          storeId,
          organization: { company: "", primaryStore: "", defaultManager: "" },
          workflow: [],
          notifications: [],
          updatedAt: new Date().toISOString(),
        };
  } finally {
    client.release();
  }
}

export async function updatePostgresStoreSettings(input: {
  storeId: string;
  settings: Partial<Omit<StoreSettingsRecord, "storeId" | "updatedAt">>;
}) {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const currentRow = await queryPostgresStoreSettings(client, input.storeId);
    if (!currentRow) {
      await client.query("rollback");
      return getPostgresStoreSettings(input.storeId);
    }
    const current = mapStoreSettings(currentRow);
    const next: StoreSettingsRecord = {
      storeId: input.storeId,
      organization: {
        ...current.organization,
        ...(input.settings.organization || {}),
      },
      workflow: input.settings.workflow ? [...input.settings.workflow] : current.workflow,
      notifications: input.settings.notifications
        ? input.settings.notifications.map((notification) => ({ ...notification }))
        : current.notifications,
      updatedAt: new Date().toISOString(),
    };

    await client.query(
      `
        insert into store_settings (
          store_id, organization_company, organization_primary_store, default_manager,
          workflow, notifications, created_at, updated_at
        )
        values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $7)
        on conflict (store_id) do update set
          organization_company = excluded.organization_company,
          organization_primary_store = excluded.organization_primary_store,
          default_manager = excluded.default_manager,
          workflow = excluded.workflow,
          notifications = excluded.notifications,
          updated_at = excluded.updated_at
      `,
      [
        input.storeId,
        next.organization.company,
        next.organization.primaryStore,
        next.organization.defaultManager,
        JSON.stringify(next.workflow),
        JSON.stringify(next.notifications),
        next.updatedAt,
      ],
    );
    await client.query(
      `
        insert into domain_events (
          id, store_id, company_id, actor_user_id, event_type, subject_type, subject_id, payload, created_at
        )
        values ($1, $2, $3, null, 'store_settings.updated', 'store', $2, $4::jsonb, $5)
      `,
      [
        id("event"),
        input.storeId,
        currentRow.company_id,
        JSON.stringify({
          organizationChanged: Boolean(input.settings.organization),
          workflowChanged: Array.isArray(input.settings.workflow),
          notificationsChanged: Array.isArray(input.settings.notifications),
        }),
        next.updatedAt,
      ],
    );

    await client.query("commit");
    return getPostgresStoreSettings(input.storeId);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listPostgresStoreUsers(storeId: string) {
  const result = await getPostgresPool().connect();
  try {
    return (await queryPostgresStoreUsers(result, storeId)).map(mapStoreUser);
  } finally {
    result.release();
  }
}

export async function getPostgresStoreUserStoreId(userId: string) {
  const result = await getPostgresPool().query<{ store_id: string }>(
    `
      select store_id
      from store_users
      where user_id = $1
        and status <> 'inactive'
      order by updated_at desc
      limit 1
    `,
    [userId],
  );
  return result.rows[0]?.store_id;
}

export async function invitePostgresStoreUser(input: { storeId: string; name: string; email: string; role: UserRole }) {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  if (!name || !email) return undefined;

  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const storeResult = await client.query<{ company_id: string }>("select company_id from stores where id = $1 for update", [input.storeId]);
    const store = storeResult.rows[0];
    if (!store) {
      await client.query("rollback");
      return undefined;
    }
    const timestamp = new Date().toISOString();
    const userResult = await client.query<{ id: string }>(
      `
        insert into users (id, company_id, email, email_normalized, name, status, created_at, updated_at)
        values ($1, $2, $3, $4, $5, 'invited', $6, $6)
        on conflict (email_normalized) do update set
          company_id = coalesce(users.company_id, excluded.company_id),
          email = excluded.email,
          name = excluded.name,
          status = case when users.status = 'inactive' then 'invited' else users.status end,
          updated_at = excluded.updated_at
        returning id
      `,
      [id("user"), store.company_id, input.email.trim(), email, name, timestamp],
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) {
      await client.query("rollback");
      return undefined;
    }
    const role = labelStoreUserRoleToDb(input.role);
    if (input.role === "Admin") {
      await client.query(
        `
          update store_users
          set role = 'supervisor', updated_at = $2
          where store_id = $1
            and role in ('admin', 'store_owner')
        `,
        [input.storeId, timestamp],
      );
    }
    await client.query(
      `
        insert into store_users (id, store_id, user_id, role, status, created_at, updated_at)
        values ($1, $2, $3, $4, 'invited', $5, $5)
        on conflict (store_id, user_id) do update set
          role = excluded.role,
          status = 'invited',
          updated_at = excluded.updated_at
      `,
      [id("store-user"), input.storeId, userId, role, timestamp],
    );
    await client.query(
      `
        insert into domain_events (
          id, store_id, company_id, actor_user_id, event_type, subject_type, subject_id, payload, created_at
        )
        values ($1, $2, $3, null, 'store_user.invited', 'user', $4, $5::jsonb, $6)
      `,
      [id("event"), input.storeId, store.company_id, userId, JSON.stringify({ role }), timestamp],
    );
    const users = (await queryPostgresStoreUsers(client, input.storeId)).map(mapStoreUser);
    const user = users.find((candidate) => candidate.id === userId);
    await client.query("commit");
    return user ? { user, users } : undefined;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePostgresStoreUser(input: { userId: string; role?: UserRole; status?: ManagerUser["status"] }) {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const existingResult = await client.query<StoreUserRow>(
      `
        select u.id, su.store_id, s.company_id, u.name, u.email, su.role, su.status
        from store_users su
        join users u on u.id = su.user_id
        join stores s on s.id = su.store_id
        where su.user_id = $1
          and su.status <> 'inactive'
        order by su.updated_at desc
        limit 1
        for update of su
      `,
      [input.userId],
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      await client.query("rollback");
      return undefined;
    }
    const timestamp = new Date().toISOString();
    if (input.role === "Admin") {
      await client.query(
        `
          update store_users
          set role = 'supervisor', updated_at = $2
          where store_id = $1
            and role in ('admin', 'store_owner')
        `,
        [existing.store_id, timestamp],
      );
    }
    await client.query(
      `
        update store_users
        set
          role = coalesce($2::text, role),
          status = coalesce($3::text, status),
          updated_at = $4
        where store_id = $1
          and user_id = $5
      `,
      [
        existing.store_id,
        input.role ? labelStoreUserRoleToDb(input.role) : null,
        labelStoreUserStatusToDb(input.status) || null,
        timestamp,
        input.userId,
      ],
    );
    await client.query(
      `
        insert into domain_events (
          id, store_id, company_id, actor_user_id, event_type, subject_type, subject_id, payload, created_at
        )
        values ($1, $2, $3, null, 'store_user.updated', 'user', $4, $5::jsonb, $6)
      `,
      [id("event"), existing.store_id, existing.company_id, input.userId, JSON.stringify({ role: input.role, status: input.status }), timestamp],
    );
    const users = (await queryPostgresStoreUsers(client, existing.store_id)).map(mapStoreUser);
    const user = users.find((candidate) => candidate.id === input.userId);
    await client.query("commit");
    return user ? { user, users } : undefined;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function removePostgresStoreUser(userId: string) {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const existingResult = await client.query<StoreUserRow>(
      `
        select u.id, su.store_id, s.company_id, u.name, u.email, su.role, su.status
        from store_users su
        join users u on u.id = su.user_id
        join stores s on s.id = su.store_id
        where su.user_id = $1
          and su.status <> 'inactive'
        order by su.updated_at desc
        limit 1
        for update of su
      `,
      [userId],
    );
    const existing = existingResult.rows[0];
    if (!existing || dbStoreUserRoleToLabel(existing.role) === "Admin") {
      await client.query("rollback");
      return undefined;
    }
    const timestamp = new Date().toISOString();
    await client.query(
      `
        update store_users
        set status = 'inactive', updated_at = $2
        where store_id = $1
          and user_id = $3
      `,
      [existing.store_id, timestamp, userId],
    );
    await client.query(
      `
        insert into domain_events (
          id, store_id, company_id, actor_user_id, event_type, subject_type, subject_id, payload, created_at
        )
        values ($1, $2, $3, null, 'store_user.removed', 'user', $4, '{}'::jsonb, $5)
      `,
      [id("event"), existing.store_id, existing.company_id, userId, timestamp],
    );
    const users = (await queryPostgresStoreUsers(client, existing.store_id)).map(mapStoreUser);
    await client.query("commit");
    return { user: mapStoreUser(existing), users };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function transferPostgresStoreAdmin(input: { storeId: string; toUserId: string }) {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const storeResult = await client.query<{ company_id: string }>("select company_id from stores where id = $1 for update", [input.storeId]);
    const store = storeResult.rows[0];
    const targetResult = await client.query<StoreUserRow>(
      `
        select u.id, su.store_id, s.company_id, u.name, u.email, su.role, su.status
        from store_users su
        join users u on u.id = su.user_id
        join stores s on s.id = su.store_id
        where su.store_id = $1
          and su.user_id = $2
          and su.status <> 'inactive'
        for update of su
      `,
      [input.storeId, input.toUserId],
    );
    const target = targetResult.rows[0];
    if (!store || !target) {
      await client.query("rollback");
      return undefined;
    }
    const timestamp = new Date().toISOString();
    await client.query(
      `
        update store_users
        set role = case when user_id = $2 then 'store_owner' else 'supervisor' end,
            updated_at = $3
        where store_id = $1
      `,
      [input.storeId, input.toUserId, timestamp],
    );
    await client.query(
      `
        insert into domain_events (
          id, store_id, company_id, actor_user_id, event_type, subject_type, subject_id, payload, created_at
        )
        values ($1, $2, $3, null, 'store_user.admin_transferred', 'user', $4, '{}'::jsonb, $5)
      `,
      [id("event"), input.storeId, store.company_id, input.toUserId, timestamp],
    );
    const users = (await queryPostgresStoreUsers(client, input.storeId)).map(mapStoreUser);
    const user = users.find((candidate) => candidate.id === input.toUserId);
    await client.query("commit");
    return user ? { user, users } : undefined;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function queryPostgresInviteSettings(client: PoolClient, storeId: string) {
  const result = await client.query<StoreInviteSettingsRow>(
    `
      select
        store_id,
        calendar_provider,
        account,
        from_name,
        reply_to,
        timezone,
        default_duration,
        location,
        add_links,
        attach_ics,
        remind24,
        remind1,
        note_template
      from store_invite_settings
      where store_id = $1
      limit 1
    `,
    [storeId],
  );
  return result.rows[0];
}

export async function getPostgresStoreInviteSettings(storeId: string) {
  const client = await getPostgresPool().connect();
  try {
    return mapInviteSettings(await queryPostgresInviteSettings(client, storeId));
  } finally {
    client.release();
  }
}

async function upsertPostgresIntegrationRows(client: PoolClient, storeId: string, settings: InviteSettings, timestamp: string) {
  for (const provider of ["google", "microsoft"] as CalProvider[]) {
    const connected = settings.calendarProvider === provider;
    await client.query(
      `
        insert into store_integrations (
          id, store_id, provider, account, status, scopes, connected_at, created_at, updated_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6::jsonb,
          $7,
          $8,
          $8
        )
        on conflict (store_id, provider) do update set
          account = excluded.account,
          status = excluded.status,
          scopes = excluded.scopes,
          connected_at = excluded.connected_at,
          updated_at = excluded.updated_at
      `,
      [
        id("store-integration"),
        storeId,
        provider,
        connected ? settings.account : "",
        connected ? "connected" : "disconnected",
        JSON.stringify(integrationScopes(provider)),
        connected ? timestamp : null,
        timestamp,
      ],
    );
  }
}

export async function updatePostgresStoreInviteSettings(input: { storeId: string; inviteSettings: Partial<InviteSettings> }) {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const existing = mapInviteSettings(await queryPostgresInviteSettings(client, input.storeId));
    const next: InviteSettings = {
      ...existing,
      ...input.inviteSettings,
    };
    const timestamp = new Date().toISOString();
    await client.query(
      `
        insert into store_invite_settings (
          store_id,
          calendar_provider,
          account,
          from_name,
          reply_to,
          timezone,
          default_duration,
          location,
          add_links,
          attach_ics,
          remind24,
          remind1,
          note_template,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
        on conflict (store_id) do update set
          calendar_provider = excluded.calendar_provider,
          account = excluded.account,
          from_name = excluded.from_name,
          reply_to = excluded.reply_to,
          timezone = excluded.timezone,
          default_duration = excluded.default_duration,
          location = excluded.location,
          add_links = excluded.add_links,
          attach_ics = excluded.attach_ics,
          remind24 = excluded.remind24,
          remind1 = excluded.remind1,
          note_template = excluded.note_template,
          updated_at = excluded.updated_at
      `,
      [
        input.storeId,
        next.calendarProvider,
        next.account,
        next.fromName,
        next.replyTo,
        next.timezone,
        next.defaultDuration,
        next.location,
        next.addLinks,
        next.attachIcs,
        next.remind24,
        next.remind1,
        next.noteTemplate,
        timestamp,
      ],
    );
    await upsertPostgresIntegrationRows(client, input.storeId, next, timestamp);
    await client.query("commit");
    return next;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listPostgresStoreIntegrations(storeId: string) {
  const client = await getPostgresPool().connect();
  try {
    const result = await client.query<StoreIntegrationRow>(
      `
        select
          id,
          store_id,
          provider,
          account,
          status,
          scopes,
          connected_at::text
        from store_integrations
        where store_id = $1
        order by case provider when 'google' then 0 else 1 end
      `,
      [storeId],
    );
    if (result.rows.length > 0) return result.rows.map(mapStoreIntegration);
    const settings = mapInviteSettings(await queryPostgresInviteSettings(client, storeId));
    return defaultIntegrationsFromSettings(settings);
  } finally {
    client.release();
  }
}

export async function connectPostgresStoreIntegration(input: { storeId: string; provider: CalProvider }) {
  const current = await getPostgresStoreInviteSettings(input.storeId);
  const inviteSettings = await updatePostgresStoreInviteSettings({
    storeId: input.storeId,
    inviteSettings: {
      calendarProvider: input.provider,
      account: current.account,
    },
  });
  return {
    integrations: await listPostgresStoreIntegrations(input.storeId),
    inviteSettings,
  };
}

export async function disconnectPostgresStoreIntegration(input: { storeId: string; provider: CalProvider }) {
  const current = await getPostgresStoreInviteSettings(input.storeId);
  const inviteSettings = await updatePostgresStoreInviteSettings({
    storeId: input.storeId,
    inviteSettings: {
      calendarProvider: current.calendarProvider === input.provider ? null : current.calendarProvider,
    },
  });
  return {
    integrations: await listPostgresStoreIntegrations(input.storeId),
    inviteSettings,
  };
}

async function listPostgresApplicationSummariesWithClient(client: PoolClient, input: ListPostgresApplicationSummariesInput) {
  const query = input.query?.trim() || "";
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const result = await client.query<ApplicationSummaryRow>(
    `
      select
        count(*) over()::text as total_count,
        a.id as application_id,
        a.store_id,
        a.job_id,
        a.applicant_profile_id,
        a.source,
        a.stage,
        a.status_reason,
        a.current_owner_user_id,
        a.submitted_at::text,
        a.last_activity_at::text,
        a.created_at::text,
        a.updated_at::text,
        ap.full_name as applicant_full_name,
        ap.email as applicant_email,
        ap.phone as applicant_phone,
        ap.location as applicant_location,
        ap.resume_headline as applicant_resume_headline,
        ap.summary as applicant_summary,
        ap.visibility as applicant_visibility,
        ap.created_at::text as applicant_created_at,
        ap.updated_at::text as applicant_updated_at,
        pj.title as job_title,
        pj.location as job_location,
        jc.status as jewelcert_status,
        gm.status as gemmatch_status,
        gm.result_profile_code as gemmatch_profile,
        gm.fit_rating as gemmatch_fit,
        gm.fit_score as gemmatch_fit_score,
        i.status as interview_status,
        i.starts_at::text as next_interview_at,
        coalesce(notes.note_count, 0)::text as note_count
      from applications a
      join applicant_profiles ap on ap.id = a.applicant_profile_id
      left join public_jobs pj on pj.id = a.job_id
      left join lateral (
        select status
        from jewelcert_invites
        where application_id = a.id
        order by created_at desc
        limit 1
      ) jc on true
      left join lateral (
        select status, result_profile_code, fit_rating, fit_score
        from gemmatch_invites
        where application_id = a.id
        order by created_at desc
        limit 1
      ) gm on true
      left join lateral (
        select status, starts_at
        from interviews
        where application_id = a.id
          and status = 'scheduled'
        order by starts_at desc
        limit 1
      ) i on true
      left join lateral (
        select count(*) as note_count
        from applicant_notes
        where application_id = a.id
          and deleted_at is null
      ) notes on true
      where a.store_id = $1
        and a.source <> 'jewellink_employee'
        and ($2::text is null or a.stage = $2)
        and (
          $3::text = ''
          or ap.full_name ilike '%' || $3 || '%'
          or ap.email ilike '%' || $3 || '%'
          or coalesce(ap.location, '') ilike '%' || $3 || '%'
          or coalesce(pj.title, '') ilike '%' || $3 || '%'
        )
      order by a.last_activity_at desc
      limit $4
      offset $5
    `,
    [input.storeId, input.stage ?? null, query, limit, offset],
  );

  return {
    storeId: input.storeId,
    filters: {
      q: query || null,
      stage: input.stage ?? null,
    },
    total: Number(result.rows[0]?.total_count ?? 0),
    count: result.rows.length,
    items: result.rows.map(mapApplicationSummary),
  };
}

export async function listPostgresApplicationSummaries(input: ListPostgresApplicationSummariesInput) {
  const result = await getPostgresPool().connect();
  try {
    return await listPostgresApplicationSummariesWithClient(result, input);
  } finally {
    result.release();
  }
}

async function listPostgresNotesForApplications(applicationIds: string[]) {
  if (applicationIds.length === 0) return new Map<string, ApplicantNoteRecord[]>();
  const result = await getPostgresPool().query<ApplicantNoteRow>(
    `
      select
        id, application_id, store_id, author_user_id, body, visibility, note_type, created_at::text,
        updated_at::text
      from applicant_notes
      where application_id = any($1::text[])
        and deleted_at is null
      order by created_at desc
    `,
    [applicationIds],
  );
  const grouped = new Map<string, ApplicantNoteRecord[]>();
  for (const row of result.rows) {
    const note = mapApplicantNote(row);
    grouped.set(note.applicationId, [...(grouped.get(note.applicationId) || []), note]);
  }
  return grouped;
}

export async function listPostgresStoreApplicants(input: ListPostgresStoreApplicantsInput) {
  const summaries = await listPostgresApplicationSummaries({
    storeId: input.storeId,
    query: input.q || "",
    limit: 100,
  });
  const notesByApplication = await listPostgresNotesForApplications(
    summaries.items.map((item) => item.application.id),
  );
  return summaries.items
    .map((item) => {
      const status = statusFromStage(item.application.stage);
      return {
        id: slugify(item.applicant.fullName) || item.applicant.id,
        profileId: item.applicant.id,
        applicationId: item.application.id,
        linkable: true,
        name: item.applicant.fullName,
        initials: initials(item.applicant.fullName),
        role: item.job?.title || item.applicant.resumeHeadline || "Jewelry role",
        status,
        stage: item.application.stage,
        appliedDate: item.application.submittedAt,
        lastActivity: item.application.lastActivityAt,
        email: item.applicant.email,
        location: item.applicant.location,
        notesCount: item.noteCount,
        notes: notesByApplication.get(item.application.id) || [],
      };
    })
    .filter((row) => {
      if (input.scope === "Active" && row.status !== "Active") return false;
      if (input.scope === "Past" && row.status === "Active") return false;
      if (input.role && input.role !== "All" && row.role !== input.role) return false;
      return true;
    });
}

export async function getPostgresApplicantProfile(email?: string | null) {
  const normalizedEmail = normalizeEmail(email || "maya.chen@email.com");
  const result = await getPostgresPool().query<{
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    location: string | null;
    resume_headline: string | null;
    summary: string | null;
    visibility: ApplicantProfileRecord["visibility"];
    created_at: string;
    updated_at: string;
  }>(
    `
      select
        id,
        full_name,
        email,
        phone,
        location,
        resume_headline,
        summary,
        visibility,
        created_at::text,
        updated_at::text
      from applicant_profiles
      where email_normalized = $1
      order by updated_at desc, created_at desc, id asc
      limit 1
    `,
    [normalizedEmail],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone || "",
    location: row.location || "",
    resumeHeadline: row.resume_headline || "",
    summary: row.summary || "",
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies ApplicantProfileRecord;
}

export async function listPostgresApplicantApplications(email?: string | null) {
  const normalizedEmail = normalizeEmail(email || "maya.chen@email.com");
  const result = await getPostgresPool().query<ApplicationSummaryRow>(
    `
      select
        count(*) over()::text as total_count,
        a.id as application_id,
        a.store_id,
        s.name as store_name,
        a.job_id,
        a.applicant_profile_id,
        a.source,
        a.stage,
        a.status_reason,
        a.current_owner_user_id,
        a.submitted_at::text,
        a.last_activity_at::text,
        a.created_at::text,
        a.updated_at::text,
        ap.full_name as applicant_full_name,
        ap.email as applicant_email,
        ap.phone as applicant_phone,
        ap.location as applicant_location,
        ap.resume_headline as applicant_resume_headline,
        ap.summary as applicant_summary,
        ap.visibility as applicant_visibility,
        ap.created_at::text as applicant_created_at,
        ap.updated_at::text as applicant_updated_at,
        pj.title as job_title,
        pj.location as job_location,
        jc.status as jewelcert_status,
        gm.status as gemmatch_status,
        gm.result_profile_code as gemmatch_profile,
        gm.fit_rating as gemmatch_fit,
        gm.fit_score as gemmatch_fit_score,
        i.status as interview_status,
        i.starts_at::text as next_interview_at,
        coalesce(notes.note_count, 0)::text as note_count
      from applications a
      join applicant_profiles ap on ap.id = a.applicant_profile_id
      left join stores s on s.id = a.store_id
      left join public_jobs pj on pj.id = a.job_id
      left join lateral (
        select status
        from jewelcert_invites
        where application_id = a.id
        order by created_at desc
        limit 1
      ) jc on true
      left join lateral (
        select status, result_profile_code, fit_rating, fit_score
        from gemmatch_invites
        where application_id = a.id
        order by created_at desc
        limit 1
      ) gm on true
      left join lateral (
        select status, starts_at
        from interviews
        where application_id = a.id
          and status = 'scheduled'
        order by starts_at desc
        limit 1
      ) i on true
      left join lateral (
        select count(*) as note_count
        from applicant_notes
        where application_id = a.id
          and deleted_at is null
      ) notes on true
      where ap.email_normalized = $1
        and a.source <> 'jewellink_employee'
      order by a.last_activity_at desc
      limit 100
    `,
    [normalizedEmail],
  );
  return result.rows.map(mapApplicationSummary);
}

function applicantInviteApplication(row: {
  application_id: string;
  store_id: string;
  job_id: string | null;
  applicant_profile_id: string;
  source: ApplicationRecord["source"];
  stage: ApplicationStage;
  status_reason: string | null;
  current_owner_user_id: string | null;
  submitted_at: string;
  last_activity_at: string;
  application_created_at: string;
  application_updated_at: string;
}) {
  return {
    id: row.application_id,
    storeId: row.store_id,
    jobId: row.job_id || "",
    applicantProfileId: row.applicant_profile_id,
    source: row.source,
    stage: row.stage,
    statusReason: optional(row.status_reason),
    currentOwnerUserId: optional(row.current_owner_user_id),
    submittedAt: row.submitted_at,
    lastActivityAt: row.last_activity_at,
    createdAt: row.application_created_at,
    updatedAt: row.application_updated_at,
  } satisfies ApplicationRecord;
}

function applicantInviteJob(row: { job_id: string | null; job_title: string | null; job_location: string | null }) {
  return row.job_id
    ? {
        id: row.job_id,
        title: row.job_title || "",
        location: optional(row.job_location),
      }
    : undefined;
}

export type ApplicantInviteIdentity = {
  authSource?: "native" | "jewellink_sso";
  upstreamUserId?: string | null;
};

export async function listPostgresApplicantInvites(
  email?: string | null,
  status?: string | null,
  identity?: ApplicantInviteIdentity,
) {
  const normalizedEmail = normalizeEmail(email || "maya.chen@email.com");
  const authSource = identity?.authSource || "native";
  const upstreamUserId = authSource === "jewellink_sso"
    ? identity?.upstreamUserId?.trim() || ""
    : "";
  const jewelcertResult = await getPostgresPool().query<
    JewelCertInviteRow & {
      application_id: string;
      store_name: string;
      store_location: string | null;
      job_id: string | null;
      job_title: string | null;
      job_location: string | null;
      applicant_profile_id: string;
      source: ApplicationRecord["source"];
      stage: ApplicationStage;
      status_reason: string | null;
      current_owner_user_id: string | null;
      submitted_at: string;
      last_activity_at: string;
      application_created_at: string;
      application_updated_at: string;
    }
  >(
    `
      select
        ji.id,
        ji.application_id,
        ji.store_id,
        ji.assessment_package_id,
        ji.sent_by_user_id,
        ji.sent_to_email,
        ji.status,
        ji.component_ids,
        ji.course_slugs,
        ji.expires_at::text,
        ji.sent_at::text,
        ji.completed_at::text,
        s.name as store_name,
        s.location_label as store_location,
        a.job_id,
        a.applicant_profile_id,
        a.source,
        a.stage,
        a.status_reason,
        a.current_owner_user_id,
        a.submitted_at::text,
        a.last_activity_at::text,
        a.created_at::text as application_created_at,
        a.updated_at::text as application_updated_at,
        pj.title as job_title,
        pj.location as job_location
      from jewelcert_invites ji
      join applications a on a.id = ji.application_id
      join applicant_profiles ap on ap.id = a.applicant_profile_id
      join stores s on s.id = ji.store_id
      left join public_jobs pj on pj.id = a.job_id
      where (
        (
          ji.external_user_id is null
          and a.source <> 'jewellink_employee'
          and ap.email_normalized = $1
        )
        or (
          $2::text = 'jewellink_sso'
          and ji.external_user_id = $3
        )
      )
      order by ji.sent_at desc nulls last, ji.completed_at desc nulls last, ji.id desc
    `,
    [normalizedEmail, authSource, upstreamUserId],
  );
  const gemmatchResult = await getPostgresPool().query<
    GemMatchInviteRow & {
      application_id: string;
      store_name: string;
      store_location: string | null;
      job_id: string | null;
      job_title: string | null;
      job_location: string | null;
      applicant_profile_id: string;
      source: ApplicationRecord["source"];
      stage: ApplicationStage;
      status_reason: string | null;
      current_owner_user_id: string | null;
      submitted_at: string;
      last_activity_at: string;
      application_created_at: string;
      application_updated_at: string;
    }
  >(
    `
      select
        gi.id,
        gi.application_id,
        gi.store_id,
        gi.sent_by_user_id,
        gi.status,
        gi.result_profile_code,
        gi.fit_rating,
        gi.result_mix,
        gi.fit_score,
        gi.created_at::text,
        gi.completed_at::text,
        s.name as store_name,
        s.location_label as store_location,
        a.job_id,
        a.applicant_profile_id,
        a.source,
        a.stage,
        a.status_reason,
        a.current_owner_user_id,
        a.submitted_at::text,
        a.last_activity_at::text,
        a.created_at::text as application_created_at,
        a.updated_at::text as application_updated_at,
        pj.title as job_title,
        pj.location as job_location
      from gemmatch_invites gi
      join applications a on a.id = gi.application_id
      join applicant_profiles ap on ap.id = a.applicant_profile_id
      join stores s on s.id = gi.store_id
      left join public_jobs pj on pj.id = a.job_id
      where (
        (
          a.source <> 'jewellink_employee'
          and ap.email_normalized = $1
          and not exists (
            select 1
            from jewelcert_invites external_invite
            where external_invite.application_id = a.id
              and external_invite.external_user_id is not null
          )
        )
        or (
          $2::text = 'jewellink_sso'
          and exists (
            select 1
            from jewelcert_invites external_invite
            where external_invite.application_id = a.id
              and external_invite.external_user_id = $3
          )
        )
      )
      order by gi.created_at desc, gi.id desc
    `,
    [normalizedEmail, authSource, upstreamUserId],
  );
  const items = [
    ...jewelcertResult.rows.map((row) => ({
      ...mapJewelCertInvite(row),
      kind: "JewelCert" as const,
      sortAt: row.sent_at || row.completed_at || "",
      application: applicantInviteApplication(row),
      job: applicantInviteJob(row),
      store: { id: row.store_id, name: row.store_name, location: optional(row.store_location) },
    })),
    ...gemmatchResult.rows.map((row) => ({
      ...mapGemMatchInvite(row),
      kind: "GemMatch" as const,
      sortAt: row.created_at || row.completed_at || "",
      application: applicantInviteApplication(row),
      job: applicantInviteJob(row),
      store: { id: row.store_id, name: row.store_name, location: optional(row.store_location) },
    })),
  ]
    .filter((invite) => !status || invite.status === status)
    .sort((a, b) => b.sortAt.localeCompare(a.sortAt));
  return items;
}

export async function getPostgresApplicantHome(
  email?: string | null,
  inviteIdentity?: ApplicantInviteIdentity,
) {
  const [applicant, applications, interviews, invites] = await Promise.all([
    getPostgresApplicantProfile(email),
    listPostgresApplicantApplications(email),
    listPostgresApplicantInterviews(email),
    listPostgresApplicantInvites(email, null, inviteIdentity),
  ]);
  const active = applications.filter((item) =>
    ["applied", "jewelcert", "gemmatch", "interview", "offer"].includes(item.application.stage),
  );
  const pendingInvites = invites.filter((invite) => invite.status !== "completed");
  const scheduledInterviews = interviews.filter((interview) => interview.status === "scheduled");
  const nextApplication = active.at(0);

  return {
    applicant,
    counts: {
      activeApplications: active.length,
      completedInvites: invites.filter((invite) => invite.status === "completed").length,
      pendingInvites: pendingInvites.length,
      upcomingInterviews: scheduledInterviews.length,
    },
    nextStep: nextApplication
      ? {
          applicationId: nextApplication.application.id,
          stage: nextApplication.application.stage,
          role: nextApplication.job?.title,
          storeId: nextApplication.application.storeId,
        }
      : null,
    upcomingInterview: scheduledInterviews.at(0) || null,
    pendingInvite: pendingInvites.at(0) || null,
  };
}

async function getPostgresApplicationDetailWithClient(client: PoolClient, input: {
  applicationId: string;
  storeId: string;
}): Promise<ApplicationDetail | undefined> {
  const detailResult = await client.query<ApplicationDetailRow>(
    `
      select
        a.id as application_id,
        a.store_id,
        a.job_id,
        a.applicant_profile_id,
        a.source,
        a.stage,
        a.status_reason,
        a.current_owner_user_id,
        a.submitted_at::text,
        a.last_activity_at::text,
        a.created_at::text as application_created_at,
        a.updated_at::text as application_updated_at,
        ap.full_name as applicant_full_name,
        ap.email as applicant_email,
        ap.phone as applicant_phone,
        ap.location as applicant_location,
        ap.resume_headline as applicant_resume_headline,
        ap.summary as applicant_summary,
        ap.visibility as applicant_visibility,
        ap.created_at::text as applicant_created_at,
        ap.updated_at::text as applicant_updated_at,
        ar.id as resume_id,
        ar.summary as resume_summary,
        ar.work_experience,
        ar.education,
        ar.skills,
        ar.portfolio_links,
        ar.course_credential_ids,
        ar.updated_at::text as resume_updated_at,
        pj.public_page_id,
        pj.title as job_title,
        pj.location as job_location,
        pj.employment_type,
        pj.compensation_summary,
        pj.description as job_description,
        pj.requirements,
        pj.ideal_gemmatch_mix,
        pj.required_assessment_ids,
        pj.required_course_ids,
        pj.status as job_status,
        pj.opened_at::text,
        pj.closed_at::text
      from applications a
      join applicant_profiles ap on ap.id = a.applicant_profile_id
      left join applicant_resumes ar on ar.applicant_profile_id = ap.id
      left join public_jobs pj on pj.id = a.job_id
      where a.id = $1
        and a.store_id = $2
      limit 1
    `,
    [input.applicationId, input.storeId],
  );
  const row = detailResult.rows[0];
  if (!row) return undefined;

  const attachments = await client.query<ApplicationAttachmentRow>(
    `
      select id, application_id, store_id, kind, original_filename, mime_type,
             file_size_bytes, sha256, created_at::text
      from application_attachments
      where application_id = $1 and store_id = $2
      order by created_at desc
    `,
    [input.applicationId, input.storeId],
  );
  const stageEvents = await client.query<StageEventRow>(
    `
      select id, application_id, from_stage, to_stage, actor_user_id, reason, metadata, created_at::text
      from application_stage_events
      where application_id = $1
      order by created_at desc
    `,
    [input.applicationId],
  );
  const jewelcertInvites = await client.query<JewelCertInviteRow>(
    `
      select
        id, application_id, store_id, assessment_package_id, sent_by_user_id, sent_to_email,
        status, expires_at::text, sent_at::text, completed_at::text
      from jewelcert_invites
      where application_id = $1
      order by created_at desc
    `,
    [input.applicationId],
  );
  const gemmatchInvites = await client.query<GemMatchInviteRow>(
    `
      select
        id, application_id, store_id, sent_by_user_id, status, result_profile_code, fit_rating,
        result_mix, fit_score, created_at::text, completed_at::text
      from gemmatch_invites
      where application_id = $1
      order by created_at desc
    `,
    [input.applicationId],
  );
  const interviews = await client.query<InterviewRow>(
    `
      select
        id, application_id, store_id, scheduled_by_user_id, interviewer_user_ids, starts_at::text,
        ends_at::text, location_type, location_details, status, outcome, created_at::text,
        updated_at::text
      from interviews
      where application_id = $1
      order by starts_at desc
    `,
    [input.applicationId],
  );
  const notes = await client.query<ApplicantNoteRow>(
    `
      select
        id, application_id, store_id, author_user_id, body, visibility, note_type, created_at::text,
        updated_at::text
      from applicant_notes
      where application_id = $1
        and deleted_at is null
      order by created_at desc
    `,
    [input.applicationId],
  );
  const hireSyncs = await client.query<HireSyncRow>(
    `
      select
        id, application_id, store_id, jewellink_team_member_id, synced_by_user_id, sync_status,
        payload_snapshot, error_message, created_at::text, synced_at::text
      from hire_to_jewellink_syncs
      where application_id = $1
      order by created_at desc
      limit 1
    `,
    [input.applicationId],
  );

  return {
    application: mapApplication(row),
    profile: mapApplicantProfile(row),
    resume: mapApplicantResume(row),
    attachments: attachments.rows.map(mapApplicationAttachment),
    job: mapApplicationJob(row),
    stageEvents: stageEvents.rows.map(mapStageEvent),
    jewelcertInvites: jewelcertInvites.rows.map(mapJewelCertInvite),
    assessmentAttempts: [],
    gemmatchInvites: gemmatchInvites.rows.map(mapGemMatchInvite),
    interviews: interviews.rows.map(mapInterview),
    notes: notes.rows.map(mapApplicantNote),
    hireSync: hireSyncs.rows[0] ? mapHireSync(hireSyncs.rows[0]) : undefined,
  };
}

export async function getPostgresApplicationDetail(input: {
  applicationId: string;
  storeId: string;
}): Promise<ApplicationDetail | undefined> {
  const client = await getPostgresPool().connect();
  try {
    return await getPostgresApplicationDetailWithClient(client, input);
  } finally {
    client.release();
  }
}

export async function getPostgresApplicationStoreId(applicationId: string) {
  const result = await getPostgresPool().query<{ store_id: string }>(
    "select store_id from applications where id = $1 limit 1",
    [applicationId],
  );
  return result.rows[0]?.store_id;
}

export async function getPostgresApplicationResumeAttachment(input: { applicationId: string; storeId: string }) {
  const result = await getPostgresPool().query<ApplicationAttachmentRow>(
    `
      select id, application_id, store_id, kind, original_filename, mime_type,
             file_size_bytes, sha256, content, created_at::text
      from application_attachments
      where application_id = $1 and store_id = $2 and kind = 'resume'
      limit 1
    `,
    [input.applicationId, input.storeId],
  );
  const row = result.rows[0];
  if (!row?.content) return undefined;
  return { ...mapApplicationAttachment(row), content: row.content };
}

async function getPostgresStoreAssessment(input: { storeId: string; assessmentId: string }) {
  const result = await getPostgresPool().query<AssessmentRow>(
    `
      select
        id,
        store_id,
        owner,
        title,
        description,
        kind,
        status,
        targets,
        media,
        question_count,
        duration_minutes,
        updated_at::text
      from assessments
      where store_id = $1
        and id = $2
      limit 1
    `,
    [input.storeId, input.assessmentId],
  );
  const assessment = result.rows[0];
  if (!assessment) return undefined;
  const questions = await getPostgresAssessmentQuestions([assessment.id]);
  return mapCustomAssessment(assessment, questions.get(assessment.id) || []);
}

async function getPostgresAssessmentQuestions(assessmentIds: string[]) {
  if (assessmentIds.length === 0) return new Map<string, AssessmentQuestionRow[]>();
  const result = await getPostgresPool().query<AssessmentQuestionRow>(
    `
      select
        id,
        assessment_id,
        question_type,
        prompt,
        options,
        answer_index,
        sort_order
      from assessment_questions
      where assessment_id = any($1::text[])
      order by assessment_id, sort_order, id
    `,
    [assessmentIds],
  );
  const byAssessmentId = new Map<string, AssessmentQuestionRow[]>();
  for (const question of result.rows) {
    byAssessmentId.set(question.assessment_id, [...(byAssessmentId.get(question.assessment_id) || []), question]);
  }
  return byAssessmentId;
}

export async function listPostgresStoreAssessments(storeId: string): Promise<CustomAssessment[]> {
  const result = await getPostgresPool().query<AssessmentRow>(
    `
      select
        id,
        store_id,
        owner,
        title,
        description,
        kind,
        status,
        targets,
        media,
        question_count,
        duration_minutes,
        updated_at::text
      from assessments
      where store_id = $1
      order by updated_at desc, title asc
    `,
    [storeId],
  );
  const questions = await getPostgresAssessmentQuestions(result.rows.map((row) => row.id));
  return result.rows.map((row) => mapCustomAssessment(row, questions.get(row.id) || []));
}

export async function createPostgresStoreAssessment(input: {
  storeId: string;
  title: string;
  description: string;
  kind: AssessmentKind;
  questions: AssessmentQuestion[];
  status?: CustomAssessment["status"];
}) {
  const timestamp = new Date().toISOString();
  const assessmentId = `ca-${slugify(input.title) || randomUUID()}`;
  const assessmentStatus = input.status || "Draft";
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    await client.query(
      `
        insert into assessments (
          id, store_id, owner, title, description, kind, status, targets, media, question_count, duration_minutes, created_at, updated_at
        )
        values ($1, $2, 'store', $3, $4, $5, $6, '[]'::jsonb, '[]'::jsonb, $7, 0, $8, $8)
        on conflict (id) do update set
          title = excluded.title,
          description = excluded.description,
          kind = excluded.kind,
          status = excluded.status,
          question_count = excluded.question_count,
          updated_at = excluded.updated_at
      `,
      [
        assessmentId,
        input.storeId,
        input.title.trim(),
        input.description.trim(),
        input.kind,
        assessmentStatus,
        input.questions.length,
        timestamp,
      ],
    );
    await client.query("delete from assessment_questions where assessment_id = $1", [assessmentId]);
    for (const [index, question] of input.questions.entries()) {
      await client.query(
        `
          insert into assessment_questions (
            id, assessment_id, question_type, prompt, options, answer_index, sort_order, created_at, updated_at
          )
          values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $8)
        `,
        [
          assessmentQuestionId(assessmentId, question, index),
          assessmentId,
          question.type,
          question.prompt,
          JSON.stringify(question.options || []),
          question.answerIndex ?? null,
          index + 1,
          timestamp,
        ],
      );
    }
    await client.query("commit");
    return getPostgresStoreAssessment({ storeId: input.storeId, assessmentId });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePostgresStoreAssessment(input: {
  storeId: string;
  assessmentId: string;
  assessment: Partial<CustomAssessment>;
}) {
  const existing = await getPostgresStoreAssessment({ storeId: input.storeId, assessmentId: input.assessmentId });
  if (!existing) return undefined;

  const next: CustomAssessment = {
    ...existing,
    ...input.assessment,
    id: existing.id,
    owner: "Store",
    questions: input.assessment.questions || existing.questions,
  };
  const timestamp = new Date().toISOString();
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    await client.query(
      `
        update assessments
        set title = $1,
            description = $2,
            kind = $3,
            status = $4,
            question_count = $5,
            updated_at = $6
        where id = $7
          and store_id = $8
      `,
      [
        next.title.trim(),
        next.description.trim(),
        next.kind,
        next.status,
        next.questions.length,
        timestamp,
        input.assessmentId,
        input.storeId,
      ],
    );
    if (input.assessment.questions) {
      await client.query("delete from assessment_questions where assessment_id = $1", [input.assessmentId]);
      for (const [index, question] of next.questions.entries()) {
        await client.query(
          `
            insert into assessment_questions (
              id, assessment_id, question_type, prompt, options, answer_index, sort_order, created_at, updated_at
            )
            values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $8)
          `,
          [
            assessmentQuestionId(input.assessmentId, question, index),
            input.assessmentId,
            question.type,
            question.prompt,
            JSON.stringify(question.options || []),
            question.answerIndex ?? null,
            index + 1,
            timestamp,
          ],
        );
      }
    }
    await client.query("commit");
    return getPostgresStoreAssessment({ storeId: input.storeId, assessmentId: input.assessmentId });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function setPostgresStoreAssessmentStatus(input: {
  storeId: string;
  assessmentId: string;
  status: CustomAssessment["status"];
}) {
  return updatePostgresStoreAssessment({
    storeId: input.storeId,
    assessmentId: input.assessmentId,
    assessment: { status: input.status },
  });
}

export async function deletePostgresStoreAssessment(input: { storeId: string; assessmentId: string }) {
  const existing = await getPostgresStoreAssessment({ storeId: input.storeId, assessmentId: input.assessmentId });
  if (!existing) return undefined;
  await getPostgresPool().query("delete from assessments where id = $1 and store_id = $2", [input.assessmentId, input.storeId]);
  return existing;
}

export async function listPostgresAssessmentResults(storeId?: string): Promise<AssessmentResult[]> {
  const result = await getPostgresPool().query<AssessmentResultRow>(
    `
      select
        id,
        store_id,
        application_id,
        assessment_id,
        slug,
        title,
        result_type,
        candidate,
        completed_at,
        duration_minutes,
        status,
        total_score,
        score_label,
        summary,
        categories,
        traits,
        answer_review,
        recommendation,
        follow_ups,
        updated_at::text
      from assessment_results
      where ($1::text is null or store_id = $1)
      order by updated_at desc, title asc
    `,
    [storeId || null],
  );
  return result.rows.map(mapAssessmentResult);
}

export async function getPostgresAssessmentResult(attemptId: string) {
  const result = await getPostgresPool().query<AssessmentResultRow>(
    `
      select
        id,
        store_id,
        application_id,
        assessment_id,
        slug,
        title,
        result_type,
        candidate,
        completed_at,
        duration_minutes,
        status,
        total_score,
        score_label,
        summary,
        categories,
        traits,
        answer_review,
        recommendation,
        follow_ups,
        updated_at::text
      from assessment_results
      where id = $1
         or slug = $1
      limit 1
    `,
    [attemptId],
  );
  return result.rows[0] ? mapAssessmentResult(result.rows[0]) : undefined;
}

export async function getPostgresAssessmentResultStoreId(attemptId: string) {
  const result = await getPostgresPool().query<{ store_id: string }>(
    "select store_id from assessment_results where id = $1 or slug = $1 limit 1",
    [attemptId],
  );
  return result.rows[0]?.store_id;
}

export async function listPostgresApplicationJewelCertResults(applicationId: string) {
  const storeId = await getPostgresApplicationStoreId(applicationId);
  const result = await getPostgresPool().query<AssessmentResultRow>(
    `
      select
        id,
        store_id,
        application_id,
        assessment_id,
        slug,
        title,
        result_type,
        candidate,
        completed_at,
        duration_minutes,
        status,
        total_score,
        score_label,
        summary,
        categories,
        traits,
        answer_review,
        recommendation,
        follow_ups,
        updated_at::text
      from assessment_results
      where application_id = $1
         or ($2::text is not null and store_id = $2 and application_id is null)
      order by updated_at desc, title asc
    `,
    [applicationId, storeId || null],
  );
  return result.rows.map(mapAssessmentResult);
}

export async function createPostgresJewelCertDecision(applicationId: string, input: { decision: string; note: string }) {
  const storeId = await getPostgresApplicationStoreId(applicationId);
  if (!storeId) return undefined;
  const timestamp = new Date().toISOString();
  const record = {
    applicationId,
    decision: input.decision.trim(),
    note: input.note.trim(),
    createdAt: timestamp,
  };
  await getPostgresPool().query(
    `
      insert into jewelcert_decisions (
        id, application_id, store_id, actor_user_id, decision, note, created_at
      )
      values ($1, $2, $3, (select current_owner_user_id from applications where id = $2 limit 1), $4, $5, $6)
    `,
    [id("decision"), applicationId, storeId, record.decision, record.note, timestamp],
  );
  return record;
}

export async function getPostgresInterviewStoreId(interviewId: string) {
  const result = await getPostgresPool().query<{ store_id: string }>(
    "select store_id from interviews where id = $1 limit 1",
    [interviewId],
  );
  return result.rows[0]?.store_id;
}

export async function resolvePostgresApplicantApplication(
  identifier: string,
  storeId?: string | null,
): Promise<PostgresApplicationScope | undefined> {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) return undefined;

  const result = await getPostgresPool().query<{
    application_id: string;
    store_id: string;
  }>(
    `
      select a.id as application_id, a.store_id
      from applications a
      join applicant_profiles ap on ap.id = a.applicant_profile_id
      where (
          a.id = $1
          or ap.id = $1
          or ap.email_normalized = $2
          or ${slugExpression("ap.full_name")} = $2
        )
        and a.source <> 'jewellink_employee'
        and ($3::text is null or a.store_id = $3)
      order by a.last_activity_at desc
      limit 1
    `,
    [identifier, normalized, storeId || null],
  );
  const row = result.rows[0];
  return row ? { applicationId: row.application_id, storeId: row.store_id } : undefined;
}

async function listPostgresApplicantHistory(profileId: string, storeId: string) {
  const result = await getPostgresPool().query<{
    id: string;
    title: string | null;
    submitted_at: string;
    stage: ApplicationStage;
    status_reason: string | null;
  }>(
    `
      select
        a.id,
        pj.title,
        a.submitted_at::text,
        a.stage,
        a.status_reason
      from applications a
      left join public_jobs pj on pj.id = a.job_id
      where a.applicant_profile_id = $1
        and a.store_id = $2
        and a.source <> 'jewellink_employee'
      order by a.submitted_at desc
    `,
    [profileId, storeId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    role: row.title || "Jewelry role",
    appliedDate: row.submitted_at,
    outcome:
      row.stage === "hired"
        ? "Hired"
        : row.stage === "rejected"
          ? "Rejected"
          : row.stage === "withdrawn"
            ? "Withdrawn"
            : "In progress",
    note: optional(row.status_reason),
  }));
}

export async function getPostgresStoreApplicantDetail(identifier: string, storeId?: string | null) {
  const scope = await resolvePostgresApplicantApplication(identifier, storeId);
  if (!scope) return undefined;
  const detail = await getPostgresApplicationDetail({
    applicationId: scope.applicationId,
    storeId: scope.storeId,
  });
  if (!detail) return undefined;

  const latestGemMatch =
    detail.gemmatchInvites.find((invite) => invite.status === "completed") ||
    detail.gemmatchInvites.at(0);
  const resultProfile = latestGemMatch?.resultProfileCode;
  return {
    id: slugify(detail.profile.fullName) || detail.profile.id,
    profileId: detail.profile.id,
    applicationId: detail.application.id,
    profile: detail.profile,
    resume: detail.resume,
    attachments: detail.attachments,
    application: detail.application,
    job: detail.job,
    status: statusFromStage(detail.application.stage),
    applications: await listPostgresApplicantHistory(detail.profile.id, scope.storeId),
    gemmatch: latestGemMatch
      ? {
          type: gemMatchLabel(resultProfile),
          primary: (resultProfile || "C") as ProfileCode,
          // The candidate's REAL trait distribution when we have it; older
          // pre-migration rows fall back to the approximate profileMix.
          mix: latestGemMatch.resultMix ?? profileMix(resultProfile),
          fitScore: latestGemMatch.fitScore ?? gemMatchFitScore(latestGemMatch.fitRating),
          tier: latestGemMatch.fitRating || "Good fit",
        }
      : undefined,
    tests: detail.assessmentAttempts.map((attempt) => {
      const score = Number.parseInt(attempt.scoreSummary, 10);
      return {
        name: attempt.assessmentType === "knowledge_check" ? "Jewelry Knowledge" : "Sales Personality",
        score: Number.isFinite(score) ? score : 0,
        label: attempt.scoreSummary,
      };
    }),
    notes: detail.notes,
    timeline: detail.stageEvents,
    hireSync: detail.hireSync,
  };
}

export async function listPostgresApplicantNotes(identifier: string): Promise<ApplicantNoteRecord[]> {
  const scope = await resolvePostgresApplicantApplication(identifier);
  if (!scope) return [];

  const result = await getPostgresPool().query<ApplicantNoteRow>(
    `
      select
        id, application_id, store_id, author_user_id, body, visibility, note_type, created_at::text,
        updated_at::text
      from applicant_notes
      where application_id = $1
        and deleted_at is null
      order by created_at desc
    `,
    [scope.applicationId],
  );
  return result.rows.map(mapApplicantNote);
}

export async function addPostgresApplicantNote(input: AddPostgresApplicantNoteInput): Promise<ApplicantNoteRecord | undefined> {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const application = await client.query<{ company_id: string }>(
      `
        select s.company_id
        from applications a
        join stores s on s.id = a.store_id
        where a.id = $1
          and a.store_id = $2
        for update
      `,
      [input.applicationId, input.storeId],
    );
    const row = application.rows[0];
    if (!row) {
      await client.query("rollback");
      return undefined;
    }

    const timestamp = new Date().toISOString();
    const noteId = id("note");
    const domainEventId = id("event");
    const noteResult = await client.query<ApplicantNoteRow>(
      `
        insert into applicant_notes (
          id, application_id, store_id, author_user_id, body, visibility, note_type, created_at, updated_at
        )
        values (
          $1,
          $2,
          $3,
          (select id from users where id = $4 limit 1),
          $5,
          'store_internal',
          $6,
          $7,
          $7
        )
        returning
          id, application_id, store_id, author_user_id, body, visibility, note_type,
          created_at::text, updated_at::text
      `,
      [noteId, input.applicationId, input.storeId, input.actorUserId, input.body.trim(), input.noteType, timestamp],
    );
    await client.query(
      `
        update applications
        set last_activity_at = $1,
            updated_at = $1
        where id = $2
          and store_id = $3
      `,
      [timestamp, input.applicationId, input.storeId],
    );
    await client.query(
      `
        insert into domain_events (
          id, store_id, company_id, actor_user_id, event_type, subject_type, subject_id, payload, created_at
        )
        values (
          $1,
          $2,
          $3,
          (select id from users where id = $4 limit 1),
          'applicant_note.created',
          'applicant_note',
          $5,
          $6::jsonb,
          $7
        )
      `,
      [
        domainEventId,
        input.storeId,
        row.company_id,
        input.actorUserId,
        noteId,
        JSON.stringify({ applicationId: input.applicationId, noteType: input.noteType }),
        timestamp,
      ],
    );

    await client.query("commit");
    return noteResult.rows[0] ? mapApplicantNote(noteResult.rows[0]) : undefined;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getPostgresApplicantNote(noteId: string): Promise<ApplicantNoteRecord | undefined> {
  const result = await getPostgresPool().query<ApplicantNoteRow>(
    `
      select
        id, application_id, store_id, author_user_id, body, visibility, note_type, created_at::text,
        updated_at::text
      from applicant_notes
      where id = $1
        and deleted_at is null
      limit 1
    `,
    [noteId],
  );
  return result.rows[0] ? mapApplicantNote(result.rows[0]) : undefined;
}

export async function deletePostgresApplicantNote(input: {
  noteId: string;
  actorUserId: string;
}): Promise<ApplicantNoteRecord | undefined> {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const noteResult = await client.query<ApplicantNoteRow & { company_id: string }>(
      `
        select
          n.id, n.application_id, n.store_id, n.author_user_id, n.body, n.visibility, n.note_type,
          n.created_at::text, n.updated_at::text, s.company_id
        from applicant_notes n
        join stores s on s.id = n.store_id
        where n.id = $1
          and n.deleted_at is null
        for update
      `,
      [input.noteId],
    );
    const note = noteResult.rows[0];
    if (!note) {
      await client.query("rollback");
      return undefined;
    }

    const timestamp = new Date().toISOString();
    const domainEventId = id("event");
    await client.query(
      `
        update applicant_notes
        set deleted_at = $1,
            updated_at = $1
        where id = $2
      `,
      [timestamp, input.noteId],
    );
    await client.query(
      `
        update applications
        set last_activity_at = $1,
            updated_at = $1
        where id = $2
          and store_id = $3
      `,
      [timestamp, note.application_id, note.store_id],
    );
    await client.query(
      `
        insert into domain_events (
          id, store_id, company_id, actor_user_id, event_type, subject_type, subject_id, payload, created_at
        )
        values (
          $1,
          $2,
          $3,
          (select id from users where id = $4 limit 1),
          'applicant_note.deleted',
          'applicant_note',
          $5,
          $6::jsonb,
          $7
        )
      `,
      [
        domainEventId,
        note.store_id,
        note.company_id,
        input.actorUserId,
        note.id,
        JSON.stringify({ applicationId: note.application_id }),
        timestamp,
      ],
    );

    await client.query("commit");
    return mapApplicantNote(note);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listPostgresStoreJewelCertInvites(storeId: string) {
  const [result, storeAssessments] = await Promise.all([
    getPostgresPool().query<JewelCertInviteListRow>(
    `
      select
        j.id,
        j.application_id,
        j.store_id,
        j.assessment_package_id,
        j.sent_by_user_id,
        j.sent_to_email,
        j.status,
        j.component_ids,
        j.course_slugs,
        j.expires_at::text,
        j.sent_at::text,
        j.completed_at::text,
        ap.id as applicant_profile_id,
        ap.full_name as applicant_full_name,
        ap.email as applicant_email,
        ap.resume_headline as applicant_resume_headline,
        pj.title as job_title
      from jewelcert_invites j
      left join applications a on a.id = j.application_id
      left join applicant_profiles ap on ap.id = a.applicant_profile_id
      left join public_jobs pj on pj.id = a.job_id
      where j.store_id = $1
      order by j.sent_at desc nulls last, j.created_at desc
    `,
    [storeId],
    ),
    listPostgresStoreAssessments(storeId),
  ]);
  const customAssessments = new Map(storeAssessments.map((assessment) => [`assessment:${assessment.id}`, assessment.title]));
  const courseSlugs = Array.from(
    new Set(
      result.rows.flatMap((row) =>
        (row.assessment_package_id || "")
          .split("+")
          .filter((part) => part.startsWith("course:"))
          .map((part) => part.replace(/^course:/, "")),
      ),
    ),
  );
  const courseTitles = await getPostgresCourseTitles(courseSlugs);
  return result.rows.map((row) => mapJewelCertInviteListItem(row, customAssessments, courseTitles));
}

export async function createPostgresJewelCertInvite(
  input: CreatePostgresJewelCertInviteInput,
): Promise<JewelCertInviteRecord | undefined> {
  const componentIds = input.componentIds?.filter((item): item is string => typeof item === "string" && item.trim().length > 0) || [];
  const courseSlugs = input.courseSlugs?.filter((item): item is string => typeof item === "string" && item.trim().length > 0) || [];
  const packageParts = [...componentIds, ...courseSlugs.map((slug) => `course:${slug}`)];
  const assessmentPackageId = packageParts.join("+") || "package-custom-jewelcert";

  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const applicationResult = await client.query<{
      company_id: string;
      stage: ApplicationStage;
      applicant_email: string;
    }>(
      `
        select s.company_id, a.stage, ap.email as applicant_email
        from applications a
        join stores s on s.id = a.store_id
        join applicant_profiles ap on ap.id = a.applicant_profile_id
        where a.id = $1
          and a.store_id = $2
        for update
      `,
      [input.applicationId, input.storeId],
    );
    const application = applicationResult.rows[0];
    if (!application) {
      await client.query("rollback");
      return undefined;
    }

    const timestamp = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const inviteId = id("jewelcert");
    const stageEventId = id("event");
    const domainEventId = id("event");
    const inviteResult = await client.query<JewelCertInviteRow>(
      `
        insert into jewelcert_invites (
          id, application_id, store_id, assessment_package_id, sent_by_user_id, sent_to_email,
          status, component_ids, course_slugs, expires_at, sent_at, created_at,
          claim_token_version
        )
        values (
          $1,
          $2,
          $3,
          $4,
          (select id from users where id = $5 limit 1),
          $6,
          'sent',
          $7::jsonb,
          $8::jsonb,
          $9,
          $10,
          $10,
          2
        )
        returning
          id, application_id, store_id, assessment_package_id, sent_by_user_id, sent_to_email,
          status, component_ids, course_slugs, expires_at::text, sent_at::text, completed_at::text
      `,
      [
        inviteId,
        input.applicationId,
        input.storeId,
        assessmentPackageId,
        input.actorUserId,
        application.applicant_email,
        JSON.stringify(componentIds),
        JSON.stringify(courseSlugs),
        expiresAt,
        timestamp,
      ],
    );

    if (componentIds.includes("gemmatch")) {
      await client.query(
        `
          insert into gemmatch_invites (
            id, application_id, store_id, sent_by_user_id, status, created_at
          )
          values (
            $1,
            $2,
            $3,
            (select id from users where id = $4 limit 1),
            'sent',
            $5
          )
        `,
        [id("gemmatch"), input.applicationId, input.storeId, input.actorUserId, timestamp],
      );
    }

    await client.query(
      `
        update applications
        set stage = 'jewelcert',
            status_reason = 'Sent JewelCert package',
            last_activity_at = $1,
            updated_at = $1
        where id = $2
          and store_id = $3
      `,
      [timestamp, input.applicationId, input.storeId],
    );
    await client.query(
      `
        insert into application_stage_events (
          id, application_id, store_id, from_stage, to_stage, actor_user_id, reason, metadata, created_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          'jewelcert',
          (select id from users where id = $5 limit 1),
          'Sent JewelCert package',
          $6::jsonb,
          $7
        )
      `,
      [
        stageEventId,
        input.applicationId,
        input.storeId,
        application.stage,
        input.actorUserId,
        JSON.stringify({ jewelcertInviteId: inviteId, componentIds, courseSlugs }),
        timestamp,
      ],
    );
    await client.query(
      `
        insert into domain_events (
          id, store_id, company_id, actor_user_id, event_type, subject_type, subject_id, payload, created_at
        )
        values (
          $1,
          $2,
          $3,
          (select id from users where id = $4 limit 1),
          'jewelcert_invite.created',
          'jewelcert_invite',
          $5,
          $6::jsonb,
          $7
        )
      `,
      [
        domainEventId,
        input.storeId,
        application.company_id,
        input.actorUserId,
        inviteId,
        JSON.stringify({ applicationId: input.applicationId, componentIds, courseSlugs }),
        timestamp,
      ],
    );

    const completedInvites = await reconcilePostgresJewelCertCompletionWithClient(client, { inviteId });

    await client.query("commit");
    return completedInvites.find((invite) => invite.id === inviteId) || (inviteResult.rows[0] ? mapJewelCertInvite(inviteResult.rows[0]) : undefined);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listPostgresStoreInterviews(input: ListPostgresStoreInterviewsInput) {
  const result = await getPostgresPool().query<StoreInterviewListRow>(
    `
      select
        i.id,
        i.application_id,
        i.store_id,
        i.scheduled_by_user_id,
        i.interviewer_user_ids,
        i.starts_at::text,
        i.ends_at::text,
        i.location_type,
        i.location_details,
        i.status,
        i.outcome,
        i.created_at::text,
        i.updated_at::text,
        ap.id as applicant_profile_id,
        ap.full_name as applicant_full_name,
        ap.email as applicant_email,
        ap.resume_headline as applicant_resume_headline,
        pj.public_page_id,
        pj.id as job_id,
        pj.title as job_title,
        pj.location as job_location,
        pj.employment_type,
        pj.compensation_summary,
        pj.description as job_description,
        pj.requirements,
        pj.ideal_gemmatch_mix,
        pj.required_assessment_ids,
        pj.required_course_ids,
        pj.status as job_status,
        pj.opened_at::text,
        pj.closed_at::text
      from interviews i
      join applications a on a.id = i.application_id
      join applicant_profiles ap on ap.id = a.applicant_profile_id
      left join public_jobs pj on pj.id = a.job_id
      where i.store_id = $1
        and ($2::text is null or i.status = $2)
      order by i.starts_at asc
    `,
    [input.storeId, input.status ?? null],
  );
  return result.rows.map(mapStoreInterviewListItem);
}

export async function listPostgresApplicantInterviews(email?: string | null, status?: InterviewRecord["status"] | null) {
  const normalizedEmail = normalizeEmail(email || "maya.chen@email.com");
  const result = await getPostgresPool().query<ApplicantInterviewListRow>(
    `
      select
        i.id,
        i.application_id,
        i.store_id,
        s.name as store_name,
        i.scheduled_by_user_id,
        i.interviewer_user_ids,
        i.starts_at::text,
        i.ends_at::text,
        i.location_type,
        i.location_details,
        i.status,
        i.outcome,
        i.created_at::text,
        i.updated_at::text,
        ap.id as applicant_profile_id,
        ap.full_name as applicant_full_name,
        ap.email as applicant_email,
        ap.resume_headline as applicant_resume_headline,
        a.source,
        a.stage,
        a.status_reason,
        a.current_owner_user_id,
        a.submitted_at::text,
        a.last_activity_at::text,
        a.created_at::text as application_created_at,
        a.updated_at::text as application_updated_at,
        pj.public_page_id,
        pj.id as job_id,
        pj.title as job_title,
        pj.location as job_location,
        pj.employment_type,
        pj.compensation_summary,
        pj.description as job_description,
        pj.requirements,
        pj.ideal_gemmatch_mix,
        pj.required_assessment_ids,
        pj.required_course_ids,
        pj.status as job_status,
        pj.opened_at::text,
        pj.closed_at::text
      from interviews i
      join applications a on a.id = i.application_id
      join applicant_profiles ap on ap.id = a.applicant_profile_id
      left join stores s on s.id = i.store_id
      left join public_jobs pj on pj.id = a.job_id
      where ap.email_normalized = $1
        and ($2::text is null or i.status = $2)
      order by i.starts_at asc
    `,
    [normalizedEmail, status ?? null],
  );
  return result.rows.map(mapApplicantInterviewListItem);
}

export async function createPostgresInterview(input: CreatePostgresInterviewInput): Promise<InterviewRecord | undefined> {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const applicationResult = await client.query<{
      company_id: string;
      stage: ApplicationStage;
    }>(
      `
        select s.company_id, a.stage
        from applications a
        join stores s on s.id = a.store_id
        where a.id = $1
          and a.store_id = $2
        for update
      `,
      [input.applicationId, input.storeId],
    );
    const application = applicationResult.rows[0];
    if (!application) {
      await client.query("rollback");
      return undefined;
    }

    const timestamp = new Date().toISOString();
    const startsAt = resolveInterviewStartsAt(input);
    const endsAt = resolveInterviewEndsAt(startsAt, input.duration);
    const interviewId = id("interview");
    const stageEventId = id("event");
    const domainEventId = id("event");
    const interviewerUserIds = [input.interviewer || input.actorUserId].filter(Boolean);
    const interviewResult = await client.query<InterviewRow>(
      `
        insert into interviews (
          id, application_id, store_id, scheduled_by_user_id, interviewer_user_ids, starts_at,
          ends_at, location_type, location_details, status, outcome, created_at, updated_at
        )
        values (
          $1,
          $2,
          $3,
          (select id from users where id = $4 limit 1),
          $5::jsonb,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $12
        )
        returning
          id, application_id, store_id, scheduled_by_user_id, interviewer_user_ids,
          starts_at::text, ends_at::text, location_type, location_details, status, outcome,
          created_at::text, updated_at::text
      `,
      [
        interviewId,
        input.applicationId,
        input.storeId,
        input.actorUserId,
        JSON.stringify(interviewerUserIds),
        startsAt,
        endsAt,
        input.type || "in_store",
        input.location || "Store interview",
        input.status || "scheduled",
        input.notes?.trim() || null,
        timestamp,
      ],
    );

    await client.query(
      `
        update applications
        set stage = 'interview',
            status_reason = 'Scheduled interview',
            last_activity_at = $1,
            updated_at = $1
        where id = $2
          and store_id = $3
      `,
      [timestamp, input.applicationId, input.storeId],
    );
    await client.query(
      `
        insert into application_stage_events (
          id, application_id, store_id, from_stage, to_stage, actor_user_id, reason, metadata, created_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          'interview',
          (select id from users where id = $5 limit 1),
          'Scheduled interview',
          $6::jsonb,
          $7
        )
      `,
      [
        stageEventId,
        input.applicationId,
        input.storeId,
        application.stage,
        input.actorUserId,
        JSON.stringify({ interviewId, startsAt, locationType: input.type || "in_store" }),
        timestamp,
      ],
    );
    await client.query(
      `
        insert into domain_events (
          id, store_id, company_id, actor_user_id, event_type, subject_type, subject_id, payload, created_at
        )
        values (
          $1,
          $2,
          $3,
          (select id from users where id = $4 limit 1),
          'interview.scheduled',
          'interview',
          $5,
          $6::jsonb,
          $7
        )
      `,
      [
        domainEventId,
        input.storeId,
        application.company_id,
        input.actorUserId,
        interviewId,
        JSON.stringify({ applicationId: input.applicationId, startsAt, endsAt }),
        timestamp,
      ],
    );

    await client.query("commit");
    return interviewResult.rows[0] ? mapInterview(interviewResult.rows[0]) : undefined;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function createPostgresNewCandidateInterview(input: CreatePostgresNewCandidateInterviewInput) {
  const name = input.name?.trim() || "";
  const email = normalizeEmail(input.email);
  if (!name || !email.includes("@")) return undefined;

  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const storeResult = await client.query<{ company_id: string }>(
      "select company_id from stores where id = $1 and status = 'active' limit 1",
      [input.storeId],
    );
    const store = storeResult.rows[0];
    if (!store) {
      await client.query("rollback");
      return undefined;
    }
    const jobResult = await client.query<PublicJobRow>(
      `
        select
          id,
          store_id,
          public_page_id,
          title,
          location,
          employment_type,
          compensation_summary,
          description,
          requirements,
          ideal_gemmatch_mix,
          required_assessment_ids,
          required_course_ids,
          status,
          opened_at::text,
          closed_at::text
        from public_jobs
        where store_id = $1
          and (
            $2::text is null
            or id = $2
            or slug = $2
            or ${slugExpression("title")} = ${slugExpression("$2")}
          )
        order by
          case when id = $2 then 0 when slug = $2 then 1 else 2 end,
          case status when 'open' then 0 when 'draft' then 1 when 'paused' then 2 else 3 end,
          created_at desc
        limit 1
      `,
      [input.storeId, input.jobId || input.role || null],
    );
    const job = jobResult.rows[0];
    const timestamp = new Date().toISOString();
    const profileId = id("profile");
    const resumeId = id("resume");
    const applicationId = id("app");
    const stageEventId = id("event");
    const applicationDomainEventId = id("event");
    const profile: ApplicantProfileRecord = {
      id: profileId,
      fullName: name,
      email: input.email?.trim() || email,
      phone: input.phone?.trim() || "",
      location: input.candidateLocation?.trim() || "",
      resumeHeadline: input.headline?.trim() || input.role?.trim() || job?.title || "Interview candidate",
      summary: input.summary?.trim() || "",
      visibility: "private_store_application",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const resume: ApplicantResumeRecord = {
      id: resumeId,
      applicantProfileId: profileId,
      summary: profile.summary,
      workExperience: [],
      education: [],
      skills: [],
      portfolioLinks: [],
      courseCredentialIds: [],
      updatedAt: timestamp,
    };
    const application: ApplicationRecord = {
      id: applicationId,
      storeId: input.storeId,
      jobId: job?.id || "",
      applicantProfileId: profileId,
      source: "manual_store_entry",
      stage: "interview",
      submittedAt: timestamp,
      lastActivityAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await client.query(
      `
        insert into applicant_profiles (
          id, full_name, email, email_normalized, phone, location, resume_headline, summary,
          visibility, created_at, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, 'private_store_application', $9, $9)
      `,
      [
        profile.id,
        profile.fullName,
        profile.email,
        email,
        profile.phone,
        profile.location,
        profile.resumeHeadline,
        profile.summary,
        timestamp,
      ],
    );
    await client.query(
      `
        insert into applicant_resumes (
          id, applicant_profile_id, summary, work_experience, education, skills, portfolio_links,
          course_credential_ids, created_at, updated_at
        )
        values ($1, $2, $3, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $4, $4)
      `,
      [resume.id, resume.applicantProfileId, resume.summary, timestamp],
    );
    await client.query(
      `
        insert into applications (
          id, store_id, job_id, applicant_profile_id, source, stage, submitted_at,
          last_activity_at, created_at, updated_at
        )
        values ($1, $2, $3, $4, 'manual_store_entry', 'applied', $5, $5, $5, $5)
      `,
      [application.id, application.storeId, job?.id || null, application.applicantProfileId, timestamp],
    );
    await client.query(
      `
        insert into application_stage_events (
          id, application_id, store_id, from_stage, to_stage, actor_user_id, reason, metadata, created_at
        )
        values ($1, $2, $3, null, 'applied', (select id from users where id = $4 limit 1), $5, $6::jsonb, $7)
      `,
      [
        stageEventId,
        application.id,
        input.storeId,
        input.actorUserId,
        "Candidate added while scheduling interview",
        JSON.stringify({ source: "new_candidate_interview", jobId: job?.id || null }),
        timestamp,
      ],
    );
    await client.query(
      `
        insert into domain_events (
          id, store_id, company_id, actor_user_id, event_type, subject_type, subject_id, payload, created_at
        )
        values ($1, $2, $3, (select id from users where id = $4 limit 1), 'application.created', 'application', $5, $6::jsonb, $7)
      `,
      [
        applicationDomainEventId,
        input.storeId,
        store.company_id,
        input.actorUserId,
        application.id,
        JSON.stringify({ source: "manual_store_entry", jobId: job?.id || null, applicantProfileId: profileId }),
        timestamp,
      ],
    );

    const startsAt = resolveInterviewStartsAt(input);
    const endsAt = resolveInterviewEndsAt(startsAt, input.duration);
    const interviewId = id("interview");
    const interviewStageEventId = id("event");
    const interviewDomainEventId = id("event");
    const interviewerUserIds = [input.interviewer || input.actorUserId].filter(Boolean);
    const interviewResult = await client.query<InterviewRow>(
      `
        insert into interviews (
          id, application_id, store_id, scheduled_by_user_id, interviewer_user_ids, starts_at,
          ends_at, location_type, location_details, status, outcome, created_at, updated_at
        )
        values (
          $1, $2, $3, (select id from users where id = $4 limit 1), $5::jsonb,
          $6, $7, $8, $9, 'scheduled', $10, $11, $11
        )
        returning
          id, application_id, store_id, scheduled_by_user_id, interviewer_user_ids,
          starts_at::text, ends_at::text, location_type, location_details, status, outcome,
          created_at::text, updated_at::text
      `,
      [
        interviewId,
        application.id,
        input.storeId,
        input.actorUserId,
        JSON.stringify(interviewerUserIds),
        startsAt,
        endsAt,
        input.type || "in_store",
        input.location || "Store interview",
        input.notes?.trim() || null,
        timestamp,
      ],
    );
    await client.query(
      `
        update applications
        set stage = 'interview',
            status_reason = 'Scheduled interview',
            last_activity_at = $1,
            updated_at = $1
        where id = $2
      `,
      [timestamp, application.id],
    );
    await client.query(
      `
        insert into application_stage_events (
          id, application_id, store_id, from_stage, to_stage, actor_user_id, reason, metadata, created_at
        )
        values ($1, $2, $3, 'applied', 'interview', (select id from users where id = $4 limit 1), 'Scheduled interview', $5::jsonb, $6)
      `,
      [
        interviewStageEventId,
        application.id,
        input.storeId,
        input.actorUserId,
        JSON.stringify({ interviewId, startsAt, locationType: input.type || "in_store" }),
        timestamp,
      ],
    );
    await client.query(
      `
        insert into domain_events (
          id, store_id, company_id, actor_user_id, event_type, subject_type, subject_id, payload, created_at
        )
        values ($1, $2, $3, (select id from users where id = $4 limit 1), 'interview.scheduled', 'interview', $5, $6::jsonb, $7)
      `,
      [
        interviewDomainEventId,
        input.storeId,
        store.company_id,
        input.actorUserId,
        interviewId,
        JSON.stringify({ applicationId: application.id, startsAt, endsAt, source: "new_candidate_interview" }),
        timestamp,
      ],
    );

    await client.query("commit");
    return {
      application,
      profile,
      resume,
      job: job ? mapPublicJob(job) : undefined,
      interview: interviewResult.rows[0] ? mapInterview(interviewResult.rows[0]) : undefined,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePostgresInterview(input: {
  interviewId: string;
  actorUserId: string;
  status?: InterviewRecord["status"];
  notes?: string;
}): Promise<InterviewRecord | undefined> {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const existingResult = await client.query<InterviewRow & { company_id: string }>(
      `
        select
          i.id, i.application_id, i.store_id, i.scheduled_by_user_id, i.interviewer_user_ids,
          i.starts_at::text, i.ends_at::text, i.location_type, i.location_details, i.status,
          i.outcome, i.created_at::text, i.updated_at::text, s.company_id
        from interviews i
        join stores s on s.id = i.store_id
        where i.id = $1
        for update
      `,
      [input.interviewId],
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      await client.query("rollback");
      return undefined;
    }

    const timestamp = new Date().toISOString();
    const nextStatus = input.status || existing.status;
    const nextOutcome = input.notes !== undefined ? input.notes : existing.outcome;
    const domainEventId = id("event");
    const interviewResult = await client.query<InterviewRow>(
      `
        update interviews
        set status = $1,
            outcome = $2,
            updated_at = $3
        where id = $4
        returning
          id, application_id, store_id, scheduled_by_user_id, interviewer_user_ids,
          starts_at::text, ends_at::text, location_type, location_details, status, outcome,
          created_at::text, updated_at::text
      `,
      [nextStatus, nextOutcome, timestamp, input.interviewId],
    );
    await client.query(
      `
        update applications
        set last_activity_at = $1,
            updated_at = $1
        where id = $2
          and store_id = $3
      `,
      [timestamp, existing.application_id, existing.store_id],
    );
    await client.query(
      `
        insert into domain_events (
          id, store_id, company_id, actor_user_id, event_type, subject_type, subject_id, payload, created_at
        )
        values (
          $1,
          $2,
          $3,
          (select id from users where id = $4 limit 1),
          'interview.updated',
          'interview',
          $5,
          $6::jsonb,
          $7
        )
      `,
      [
        domainEventId,
        existing.store_id,
        existing.company_id,
        input.actorUserId,
        input.interviewId,
        JSON.stringify({ applicationId: existing.application_id, fromStatus: existing.status, toStatus: nextStatus }),
        timestamp,
      ],
    );

    await client.query("commit");
    return interviewResult.rows[0] ? mapInterview(interviewResult.rows[0]) : undefined;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePostgresInterviewRsvp(input: {
  interviewId: string;
  response: "accepted" | "declined" | "tentative";
}): Promise<InterviewRecord | undefined> {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const existingResult = await client.query<InterviewRow & { company_id: string }>(
      `
        select
          i.id, i.application_id, i.store_id, i.scheduled_by_user_id, i.interviewer_user_ids,
          i.starts_at::text, i.ends_at::text, i.location_type, i.location_details, i.status,
          i.outcome, i.created_at::text, i.updated_at::text, s.company_id
        from interviews i
        join stores s on s.id = i.store_id
        where i.id = $1
        for update
      `,
      [input.interviewId],
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      await client.query("rollback");
      return undefined;
    }

    const timestamp = new Date().toISOString();
    const nextStatus = input.response === "declined" ? "cancelled" : existing.status;
    const outcome = `Applicant RSVP: ${input.response}`;
    const domainEventId = id("event");
    const interviewResult = await client.query<InterviewRow>(
      `
        update interviews
        set status = $1,
            outcome = $2,
            updated_at = $3
        where id = $4
        returning
          id, application_id, store_id, scheduled_by_user_id, interviewer_user_ids,
          starts_at::text, ends_at::text, location_type, location_details, status, outcome,
          created_at::text, updated_at::text
      `,
      [nextStatus, outcome, timestamp, input.interviewId],
    );
    await client.query(
      `
        update applications
        set last_activity_at = $1,
            updated_at = $1
        where id = $2
          and store_id = $3
      `,
      [timestamp, existing.application_id, existing.store_id],
    );
    await client.query(
      `
        insert into domain_events (
          id, store_id, company_id, actor_user_id, event_type, subject_type, subject_id, payload, created_at
        )
        values (
          $1,
          $2,
          $3,
          null,
          'interview.rsvp_updated',
          'interview',
          $4,
          $5::jsonb,
          $6
        )
      `,
      [
        domainEventId,
        existing.store_id,
        existing.company_id,
        input.interviewId,
        JSON.stringify({ applicationId: existing.application_id, response: input.response }),
        timestamp,
      ],
    );

    await client.query("commit");
    return interviewResult.rows[0] ? mapInterview(interviewResult.rows[0]) : undefined;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function resolvePostgresLocationId(client: PoolClient, storeId: string, locationId?: string | null) {
  const result = await client.query<LocationRow>(
    `
      select id, name, floor_type
      from locations
      where store_id = $1
      order by created_at asc
    `,
    [storeId],
  );
  if (result.rows.length === 0) return { locationId: null, location: undefined };
  const normalized = locationId?.trim().toLowerCase() || "";
  if (!normalized) return { locationId: null, location: result.rows[0] };
  const normalizedSlug = normalized ? slugify(normalized) : "";
  const location =
    result.rows.find((row) => row.id.toLowerCase() === normalized) ||
    result.rows.find((row) => slugify(row.name) === normalizedSlug) ||
    result.rows.find((row) => normalized.includes(slugify(row.name)) || normalized.includes(row.name.toLowerCase())) ||
    result.rows[0];
  return { locationId: location.id, location };
}

export async function listPostgresStoreLocations(storeId: string) {
  const result = await getPostgresPool().query<LocationRow>(
    `
      select id, name, floor_type
      from locations
      where store_id = $1
      order by created_at asc, name asc
    `,
    [storeId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    floorType: row.floor_type || "Powerhouse",
  }));
}

export async function listPostgresStoreTeamMembers(input: ListPostgresStoreTeamMembersInput) {
  const client = await getPostgresPool().connect();
  try {
    const resolved = await resolvePostgresLocationId(client, input.storeId, input.locationId);
    const result = await client.query<TeamMemberRow>(
      `
        select
          tm.id,
          tm.store_id,
          tm.location_id,
          tm.jewellink_team_member_id,
          tm.source_application_id,
          tm.name,
          tm.initials,
          tm.role,
          tm.gemmatch_type,
          tm.primary_profile_code,
          tm.status,
          tm.next_action,
          tm.created_at::text,
          tm.updated_at::text,
          l.name as location_name,
          l.floor_type
        from team_members tm
        left join locations l on l.id = tm.location_id
        where tm.store_id = $1
          and ($2::text is null or tm.location_id = $2)
          and tm.status <> 'removed'
        order by tm.created_at asc
      `,
      [input.storeId, input.locationId ? resolved.locationId : null],
    );
    return result.rows.map((row, index) => ({
      ...mapTeamMember(row),
      training: index === 4 ? "Clienteling starter" : index === 5 ? "Inventory Security" : "Current",
      lastCheckIn: index < 2 ? "This week" : index < 4 ? "Last week" : "Needs scheduling",
      nextAction: row.next_action || "Keep in quarterly coaching rhythm",
    }));
  } finally {
    client.release();
  }
}

export async function getPostgresStoreTeamComposition(input: ListPostgresStoreTeamMembersInput) {
  const client = await getPostgresPool().connect();
  try {
    return getPostgresTeamComposition(client, input.storeId, input.locationId);
  } finally {
    client.release();
  }
}

export async function getPostgresTeamMemberStoreId(memberId: string) {
  const result = await getPostgresPool().query<{ store_id: string }>("select store_id from team_members where id = $1", [memberId]);
  return result.rows[0]?.store_id;
}

export async function createPostgresTeamMember(input: CreatePostgresTeamMemberInput) {
  const name = input.name.trim();
  if (!name) return undefined;
  const primary = input.primary && PROFILE_ORDER.includes(input.primary) ? input.primary : "C";
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const resolved = await resolvePostgresLocationId(client, input.storeId, input.locationId);
    const timestamp = new Date().toISOString();
    const result = await client.query<TeamMemberRow>(
      `
        insert into team_members (
          id, store_id, location_id, name, initials, role, gemmatch_type, primary_profile_code,
          status, next_action, created_at, updated_at
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8,
          'onboarding', 'Assign first 30-day training path', $9, $9
        )
        returning
          id,
          store_id,
          location_id,
          jewellink_team_member_id,
          source_application_id,
          name,
          initials,
          role,
          gemmatch_type,
          primary_profile_code,
          status,
          next_action,
          created_at::text,
          updated_at::text,
          (select name from locations where locations.id = team_members.location_id) as location_name,
          (select floor_type from locations where locations.id = team_members.location_id) as floor_type
      `,
      [
        id("team"),
        input.storeId,
        resolved.locationId,
        name,
        initials(name),
        input.role?.trim() || "Team member",
        input.type?.trim() || typeForPrimary(primary),
        primary,
        timestamp,
      ],
    );
    await client.query("commit");
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      member: {
        ...mapTeamMember(row),
        training: "Needs assignment",
        lastCheckIn: "Needs scheduling",
        nextAction: row.next_action || "Assign first 30-day training path",
      },
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function getPostgresTeamMember(client: PoolClient, memberId: string) {
  const result = await client.query<TeamMemberRow>(
    `
      select
        tm.id,
        tm.store_id,
        tm.location_id,
        tm.jewellink_team_member_id,
        tm.source_application_id,
        tm.name,
        tm.initials,
        tm.role,
        tm.gemmatch_type,
        tm.primary_profile_code,
        tm.status,
        tm.next_action,
        tm.created_at::text,
        tm.updated_at::text,
        l.name as location_name,
        l.floor_type
      from team_members tm
      left join locations l on l.id = tm.location_id
      where tm.id = $1
      limit 1
    `,
    [memberId],
  );
  return result.rows[0];
}

export async function updatePostgresTeamMember(input: UpdatePostgresTeamMemberInput) {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const existing = await getPostgresTeamMember(client, input.memberId);
    if (!existing || existing.status === "removed") {
      await client.query("rollback");
      return undefined;
    }
    const resolved = input.locationId === undefined ? { locationId: existing.location_id } : await resolvePostgresLocationId(client, existing.store_id, input.locationId);
    const status = teamStatusToDb(input.status);
    const result = await client.query<TeamMemberRow>(
      `
        update team_members
        set
          location_id = coalesce($2::text, location_id),
          status = coalesce($3::text, status),
          next_action = coalesce($4::text, next_action),
          updated_at = $5
        where id = $1
        returning
          id,
          store_id,
          location_id,
          jewellink_team_member_id,
          source_application_id,
          name,
          initials,
          role,
          gemmatch_type,
          primary_profile_code,
          status,
          next_action,
          created_at::text,
          updated_at::text,
          (select name from locations where locations.id = team_members.location_id) as location_name,
          (select floor_type from locations where locations.id = team_members.location_id) as floor_type
      `,
      [input.memberId, resolved.locationId, status, input.nextAction, new Date().toISOString()],
    );
    await client.query("commit");
    const member = result.rows[0] ? mapTeamMember(result.rows[0]) : undefined;
    return member ? { member } : undefined;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function removePostgresTeamMember(memberId: string) {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const existing = await getPostgresTeamMember(client, memberId);
    if (!existing || existing.status === "removed") {
      await client.query("rollback");
      return undefined;
    }
    await client.query(
      `
        update team_members
        set status = 'removed', updated_at = $2
        where id = $1
      `,
      [memberId, new Date().toISOString()],
    );
    const membersResult = await client.query<TeamMemberRow>(
      `
        select
          tm.id,
          tm.store_id,
          tm.location_id,
          tm.jewellink_team_member_id,
          tm.source_application_id,
          tm.name,
          tm.initials,
          tm.role,
          tm.gemmatch_type,
          tm.primary_profile_code,
          tm.status,
          tm.next_action,
          tm.created_at::text,
          tm.updated_at::text,
          l.name as location_name,
          l.floor_type
        from team_members tm
        left join locations l on l.id = tm.location_id
        where tm.store_id = $1
          and tm.status <> 'removed'
        order by tm.created_at asc
      `,
      [existing.store_id],
    );
    await client.query("commit");
    const members = membersResult.rows.map((row, index) => ({
      ...mapTeamMember(row),
      training: index === 4 ? "Clienteling starter" : index === 5 ? "Inventory Security" : "Current",
      lastCheckIn: index < 2 ? "This week" : index < 4 ? "Last week" : "Needs scheduling",
      nextAction: row.next_action || "Keep in quarterly coaching rhythm",
    }));
    return { member: mapTeamMember(existing), members };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function getPostgresTeamComposition(client: PoolClient, storeId: string, locationId?: string | null) {
  const resolved = await resolvePostgresLocationId(client, storeId, locationId);
  const membersResult = await client.query<TeamMemberRow>(
    `
      select
        tm.id,
        tm.store_id,
        tm.location_id,
        tm.jewellink_team_member_id,
        tm.source_application_id,
        tm.name,
        tm.initials,
        tm.role,
        tm.gemmatch_type,
        tm.primary_profile_code,
        tm.status,
        tm.next_action,
        tm.created_at::text,
        tm.updated_at::text,
        l.name as location_name,
        l.floor_type
      from team_members tm
      left join locations l on l.id = tm.location_id
      where tm.store_id = $1
        and ($2::text is null or tm.location_id = $2)
        and tm.status <> 'removed'
      order by tm.created_at asc
    `,
    [storeId, resolved.locationId],
  );
  const members = membersResult.rows.map(mapTeamMember);
  const counts = members.reduce<Record<ProfileCode, number>>(
    (acc, member) => {
      acc[member.primary] += 1;
      return acc;
    },
    { V: 0, C: 0, F: 0, D: 0 },
  );
  const denominator = Math.max(members.length, 1);
  const mix = Object.fromEntries(
    PROFILE_ORDER.map((profile) => [profile, Math.round((counts[profile] / denominator) * 100)]),
  ) as Mix;
  return {
    locationId: resolved.locationId,
    floorType: resolved.location?.floor_type || membersResult.rows[0]?.floor_type || "Powerhouse",
    mix,
    counts,
    tested: members.length,
    total: members.length,
    members,
  };
}

async function getPostgresHirePreviewWithClient(client: PoolClient, input: PostgresHirePreviewInput) {
  const detail = await getPostgresApplicationDetailWithClient(client, { applicationId: input.applicationId, storeId: input.storeId });
  if (!detail?.application || !detail.profile) return undefined;

  const composition = await getPostgresTeamComposition(client, input.storeId, input.locationId);
  const latestGemMatch = detail.gemmatchInvites.find((invite) => invite.resultProfileCode) || detail.gemmatchInvites.at(0);
  const primary = latestGemMatch?.resultProfileCode;
  const incomingMix = profileMix(primary);
  const before = composition.mix;
  const after = blendMix(before, incomingMix, composition.total);
  const role = input.role || detail.job?.title || detail.profile.resumeHeadline || "Associate";
  const courseCredentialIds = detail.resume?.courseCredentialIds || [];
  const teamMemberId = `jl-team-${slugify(detail.profile.fullName)}`;

  return {
    application: detail.application,
    applicant: detail.profile,
    job: detail.job,
    role,
    locationId: composition.locationId || input.locationId || "location-little-rock",
    storeId: input.storeId,
    gemmatch: {
      primary: primary || null,
      type: typeForPrimary(primary),
      fitRating: latestGemMatch?.fitRating || null,
      incomingMix,
      complete: Boolean(primary),
    },
    team: {
      before,
      after,
      delta: mixDelta(before, after),
      floorType: composition.floorType,
      memberCountBefore: composition.total,
      memberCountAfter: composition.total + 1,
      locationId: composition.locationId || input.locationId || "location-little-rock",
    },
    jewelLinkPayload: {
      teamMemberId,
      fullName: detail.profile.fullName,
      email: detail.profile.email,
      role,
      locationId: composition.locationId || input.locationId || "location-little-rock",
      gemmatchProfile: primary,
      courseCredentialIds,
      sourceApplicationId: detail.application.id,
    },
    existingSync: detail.hireSync || null,
  };
}

export async function getPostgresHirePreview(input: PostgresHirePreviewInput) {
  const client = await getPostgresPool().connect();
  try {
    return await getPostgresHirePreviewWithClient(client, input);
  } finally {
    client.release();
  }
}

export async function listPostgresHireSyncs(input: {
  storeId: string;
  status?: HireToJewelLinkSyncRecord["syncStatus"];
}) {
  const result = await getPostgresPool().query<HireSyncRow>(
    `
      select
        id, application_id, store_id, jewellink_team_member_id, synced_by_user_id, sync_status,
        payload_snapshot, error_message, created_at::text, synced_at::text
      from hire_to_jewellink_syncs
      where store_id = $1
        and ($2::text is null or sync_status = $2)
      order by created_at desc
    `,
    [input.storeId, input.status ?? null],
  );
  const details = await Promise.all(
    result.rows.map((row) => getPostgresApplicationDetail({ applicationId: row.application_id, storeId: row.store_id })),
  );
  return result.rows.map((row, index) => ({
    sync: mapHireSync(row),
    detail: details[index],
  }));
}

export async function getPostgresHireSyncForApplication(applicationId: string) {
  const result = await getPostgresPool().query<HireSyncRow>(
    `
      select
        id, application_id, store_id, jewellink_team_member_id, synced_by_user_id, sync_status,
        payload_snapshot, error_message, created_at::text, synced_at::text
      from hire_to_jewellink_syncs
      where application_id = $1
      limit 1
    `,
    [applicationId],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    sync: mapHireSync(row),
    detail: await getPostgresApplicationDetail({ applicationId, storeId: row.store_id }),
  };
}

export async function hirePostgresApplication(input: HirePostgresApplicationInput) {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const preview = await getPostgresHirePreviewWithClient(client, input);
    if (!preview) {
      await client.query("rollback");
      return undefined;
    }
    const applicationResult = await client.query<{
      company_id: string;
      stage: ApplicationStage;
      full_name: string;
    }>(
      `
        select s.company_id, a.stage, ap.full_name
        from applications a
        join stores s on s.id = a.store_id
        join applicant_profiles ap on ap.id = a.applicant_profile_id
        where a.id = $1
          and a.store_id = $2
        for update
      `,
      [input.applicationId, input.storeId],
    );
    const application = applicationResult.rows[0];
    if (!application) {
      await client.query("rollback");
      return undefined;
    }

    const existingSyncResult = await client.query<HireSyncRow>(
      `
        select
          id, application_id, store_id, jewellink_team_member_id, synced_by_user_id, sync_status,
          payload_snapshot, error_message, created_at::text, synced_at::text
        from hire_to_jewellink_syncs
        where application_id = $1
        for update
      `,
      [input.applicationId],
    );
    const existingSync = existingSyncResult.rows[0];
    if (existingSync) {
      await client.query("commit");
      return {
        ...mapHireSync(existingSync),
        preview,
      };
    }

    const timestamp = new Date().toISOString();
    const resolved = await resolvePostgresLocationId(client, input.storeId, preview.jewelLinkPayload.locationId);
    const primary = preview.gemmatch.primary || undefined;
    const teamMemberDbId = `team-${input.applicationId}`;
    const syncId = id("hire-sync");
    const stageEventId = id("event");
    const hireEventId = id("event");
    const noteId = id("note");
    const noteEventId = id("event");

    const teamMemberResult = await client.query<TeamMemberRow>(
      `
        insert into team_members (
          id, store_id, location_id, jewellink_team_member_id, source_application_id, name, initials,
          role, gemmatch_type, primary_profile_code, status, next_action, created_at, updated_at
        )
        values (
          $1,
          $2,
          $3,
          null,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          'active',
          'Queued for JewelLink provisioning',
          $10,
          $10
        )
        on conflict (id) do update set
          location_id = excluded.location_id,
          source_application_id = excluded.source_application_id,
          role = excluded.role,
          gemmatch_type = excluded.gemmatch_type,
          primary_profile_code = excluded.primary_profile_code,
          status = 'active',
          next_action = excluded.next_action,
          updated_at = excluded.updated_at
        returning
          id, store_id, location_id, jewellink_team_member_id, source_application_id, name, initials,
          role, gemmatch_type, primary_profile_code, status, next_action, created_at::text, updated_at::text,
          null::text as location_name, null::text as floor_type
      `,
      [
        teamMemberDbId,
        input.storeId,
        resolved.locationId,
        input.applicationId,
        preview.applicant.fullName,
        initials(preview.applicant.fullName),
        preview.role,
        preview.gemmatch.type,
        primary || "C",
        timestamp,
      ],
    );

    const syncResult = await client.query<HireSyncRow>(
      `
        insert into hire_to_jewellink_syncs (
          id, application_id, store_id, jewellink_team_member_id, synced_by_user_id, sync_status,
          payload_snapshot, created_at, synced_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          (select id from users where id = $5 limit 1),
          'pending',
          $6::jsonb,
          $7,
          null
        )
        returning
          id, application_id, store_id, jewellink_team_member_id, synced_by_user_id, sync_status,
          payload_snapshot, error_message, created_at::text, synced_at::text
      `,
      [
        syncId,
        input.applicationId,
        input.storeId,
        null,
        input.actorUserId,
        JSON.stringify({
          fullName: preview.applicant.fullName,
          email: preview.applicant.email,
          phone: preview.applicant.phone,
          role: preview.role,
          locationId: resolved.locationId,
          gemmatchProfile: primary,
          courseCredentialIds: preview.jewelLinkPayload.courseCredentialIds,
        }),
        timestamp,
      ],
    );

    await client.query(
      `
        update applications
        set stage = 'hired',
            status_reason = 'Confirmed hire and queued JewelLink provisioning',
            last_activity_at = $1,
            updated_at = $1
        where id = $2
          and store_id = $3
      `,
      [timestamp, input.applicationId, input.storeId],
    );
    await client.query(
      `
        insert into application_stage_events (
          id, application_id, store_id, from_stage, to_stage, actor_user_id, reason, metadata, created_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          'hired',
          (select id from users where id = $5 limit 1),
          'Confirmed hire and queued JewelLink sync',
          $6::jsonb,
          $7
        )
      `,
      [
        stageEventId,
        input.applicationId,
        input.storeId,
        application.stage,
        input.actorUserId,
        JSON.stringify({ hireSyncId: syncId, syncStatus: "pending" }),
        timestamp,
      ],
    );
    await client.query(
      `
        insert into applicant_notes (
          id, application_id, store_id, author_user_id, body, visibility, note_type, created_at, updated_at
        )
        values (
          $1,
          $2,
          $3,
          (select id from users where id = $4 limit 1),
          $5,
          'store_internal',
          'hire_handoff',
          $6,
          $6
        )
      `,
      [
        noteId,
        input.applicationId,
        input.storeId,
        input.actorUserId,
        `Hired as ${preview.role}. JewelLink account provisioning queued.`,
        timestamp,
      ],
    );
    await client.query(
      `
        insert into domain_events (
          id, store_id, company_id, actor_user_id, event_type, subject_type, subject_id, payload, created_at
        )
        values
          ($1, $2, $3, (select id from users where id = $4 limit 1), 'hire.completed', 'application', $5, $6::jsonb, $7),
          ($8, $2, $3, (select id from users where id = $4 limit 1), 'applicant_note.created', 'applicant_note', $9, $10::jsonb, $7)
      `,
      [
        hireEventId,
        input.storeId,
        application.company_id,
        input.actorUserId,
        input.applicationId,
        JSON.stringify({ hireSyncId: syncId, syncStatus: "pending" }),
        timestamp,
        noteEventId,
        noteId,
        JSON.stringify({ applicationId: input.applicationId, noteType: "hire_handoff" }),
      ],
    );

    const updatedPreview = await getPostgresHirePreviewWithClient(client, input);
    await client.query("commit");
    return {
      ...mapHireSync(syncResult.rows[0]),
      teamMember: teamMemberResult.rows[0] ? mapTeamMember(teamMemberResult.rows[0]) : undefined,
      preview: updatedPreview,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function mapApplicantResumePayload(row: ApplicantResumeRow) {
  return {
    profile: {
      id: row.profile_id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone || "",
      location: row.location || "",
      resumeHeadline: row.resume_headline || "",
      summary: row.profile_summary || "",
      visibility: row.visibility,
      createdAt: row.profile_created_at,
      updatedAt: row.profile_updated_at,
    } satisfies ApplicantProfileRecord,
    resume: row.resume_id
      ? ({
          id: row.resume_id,
          applicantProfileId: row.profile_id,
          summary: row.resume_summary || "",
          workExperience: asStringArray(row.work_experience),
          education: asStringArray(row.education),
          skills: asStringArray(row.skills),
          portfolioLinks: asStringArray(row.portfolio_links),
          courseCredentialIds: asStringArray(row.course_credential_ids),
          updatedAt: row.resume_updated_at || row.profile_updated_at,
        } satisfies ApplicantResumeRecord)
      : undefined,
    templateId: optional(row.template_id),
  };
}

export async function getPostgresApplicantResume(email?: string | null) {
  const normalizedEmail = normalizeEmail(email || "maya.chen@email.com");
  const result = await getPostgresPool().query<ApplicantResumeRow>(
    `
      select
        ap.id as profile_id,
        ap.full_name,
        ap.email,
        ap.phone,
        ap.location,
        ap.resume_headline,
        ap.summary as profile_summary,
        ap.visibility,
        ap.created_at::text as profile_created_at,
        ap.updated_at::text as profile_updated_at,
        ar.id as resume_id,
        ar.summary as resume_summary,
        ar.work_experience,
        ar.education,
        ar.skills,
        ar.portfolio_links,
        ar.course_credential_ids,
        ar.template_id,
        ar.updated_at::text as resume_updated_at
      from applicant_profiles ap
      left join applicant_resumes ar on ar.applicant_profile_id = ap.id
      where ap.email_normalized = $1
      order by ap.updated_at desc, ap.created_at desc, ap.id asc
      limit 1
    `,
    [normalizedEmail],
  );
  const row = result.rows[0];
  return row ? mapApplicantResumePayload(row) : undefined;
}

export async function updatePostgresApplicantResume(input: UpdatePostgresApplicantResumeInput) {
  const lookupEmail = normalizeEmail(input.lookupEmail || input.email || "maya.chen@email.com");
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const profileResult = await client.query<ApplicantResumeRow>(
      `
        select
          ap.id as profile_id,
          ap.full_name,
          ap.email,
          ap.phone,
          ap.location,
          ap.resume_headline,
          ap.summary as profile_summary,
          ap.visibility,
          ap.created_at::text as profile_created_at,
          ap.updated_at::text as profile_updated_at,
          ar.id as resume_id,
          ar.summary as resume_summary,
          ar.work_experience,
          ar.education,
          ar.skills,
          ar.portfolio_links,
          ar.course_credential_ids,
          ar.template_id,
          ar.updated_at::text as resume_updated_at
        from applicant_profiles ap
        left join applicant_resumes ar on ar.applicant_profile_id = ap.id
        where ap.email_normalized = $1
        order by ap.updated_at desc, ap.created_at desc, ap.id asc
        limit 1
        for update of ap
      `,
      [lookupEmail],
    );
    const current = profileResult.rows[0];
    if (!current) {
      await client.query("rollback");
      return undefined;
    }

    const timestamp = new Date().toISOString();
    const nextEmail = normalizeEmail(input.email || current.email);
    await client.query(
      `
        update applicant_profiles
        set full_name = $1,
            email = $2,
            email_normalized = $3,
            phone = $4,
            location = $5,
            resume_headline = $6,
            updated_at = $7
        where id = $8
      `,
      [
        input.fullName ?? current.full_name,
        input.email ?? current.email,
        nextEmail,
        input.phone ?? current.phone ?? "",
        input.location ?? current.location ?? "",
        input.headline ?? current.resume_headline ?? "",
        timestamp,
        current.profile_id,
      ],
    );

    const resumeId = current.resume_id || id("resume");
    await client.query(
      `
        insert into applicant_resumes (
          id, applicant_profile_id, summary, work_experience, education, skills, portfolio_links,
          course_credential_ids, template_id, created_at, updated_at
        )
        values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, $10)
        on conflict (applicant_profile_id) do update set
          summary = excluded.summary,
          work_experience = excluded.work_experience,
          education = excluded.education,
          skills = excluded.skills,
          portfolio_links = excluded.portfolio_links,
          course_credential_ids = excluded.course_credential_ids,
          template_id = excluded.template_id,
          updated_at = excluded.updated_at
      `,
      [
        resumeId,
        current.profile_id,
        input.summary ?? current.resume_summary ?? "",
        JSON.stringify(input.workExperience ?? asStringArray(current.work_experience)),
        JSON.stringify(input.education ?? asStringArray(current.education)),
        JSON.stringify(input.skills ?? asStringArray(current.skills)),
        JSON.stringify(input.portfolioLinks ?? asStringArray(current.portfolio_links)),
        JSON.stringify(asStringArray(current.course_credential_ids)),
        input.templateId ?? current.template_id,
        timestamp,
      ],
    );

    await client.query("commit");
    return getPostgresApplicantResume(nextEmail);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

const DEFAULT_APPLICANT_NOTIFICATION_PREFS: ApplicantNotificationPrefs = {
  invites: true,
  interviews: true,
  status: true,
  marketing: false,
};

export async function getPostgresApplicantNotificationPrefs(email?: string | null): Promise<ApplicantNotificationPrefs | undefined> {
  const normalizedEmail = normalizeEmail(email || "maya.chen@email.com");
  const result = await getPostgresPool().query<{
    profile_id: string;
    invites: boolean | null;
    interviews: boolean | null;
    status_updates: boolean | null;
    marketing: boolean | null;
    updated_at: string | null;
  }>(
    `
      select
        ap.id as profile_id,
        anp.invites,
        anp.interviews,
        anp.status_updates,
        anp.marketing,
        anp.updated_at::text
      from applicant_profiles ap
      left join applicant_notification_prefs anp on anp.applicant_profile_id = ap.id
      where ap.email_normalized = $1
      order by ap.updated_at desc, ap.created_at desc, ap.id asc
      limit 1
    `,
    [normalizedEmail],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    invites: row.invites ?? DEFAULT_APPLICANT_NOTIFICATION_PREFS.invites,
    interviews: row.interviews ?? DEFAULT_APPLICANT_NOTIFICATION_PREFS.interviews,
    status: row.status_updates ?? DEFAULT_APPLICANT_NOTIFICATION_PREFS.status,
    marketing: row.marketing ?? DEFAULT_APPLICANT_NOTIFICATION_PREFS.marketing,
    updatedAt: optional(row.updated_at),
  };
}

export async function updatePostgresApplicantNotificationPrefs(input: {
  email?: string | null;
  prefs: Partial<ApplicantNotificationPrefs>;
}): Promise<ApplicantNotificationPrefs | undefined> {
  const normalizedEmail = normalizeEmail(input.email || "maya.chen@email.com");
  const current = await getPostgresApplicantNotificationPrefs(normalizedEmail);
  const profile = await getPostgresPool().query<{ id: string }>(
    `select id from applicant_profiles
     where email_normalized = $1
     order by updated_at desc, created_at desc, id asc
     limit 1`,
    [normalizedEmail],
  );
  const profileId = profile.rows[0]?.id;
  if (!profileId || !current) return undefined;
  const next = {
    invites: input.prefs.invites ?? current.invites,
    interviews: input.prefs.interviews ?? current.interviews,
    status: input.prefs.status ?? current.status,
    marketing: input.prefs.marketing ?? current.marketing,
  };
  const timestamp = new Date().toISOString();
  await getPostgresPool().query(
    `
      insert into applicant_notification_prefs (
        applicant_profile_id, invites, interviews, status_updates, marketing, updated_at
      )
      values ($1, $2, $3, $4, $5, $6)
      on conflict (applicant_profile_id) do update set
        invites = excluded.invites,
        interviews = excluded.interviews,
        status_updates = excluded.status_updates,
        marketing = excluded.marketing,
        updated_at = excluded.updated_at
    `,
    [profileId, next.invites, next.interviews, next.status, next.marketing, timestamp],
  );
  return { ...next, updatedAt: timestamp };
}

function courseDurationLabel(minutes: number) {
  if (minutes <= 0) return "";
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return `${hours}h ${remainder}m`;
  }
  return `${minutes} min`;
}

function mapPostgresCourse(row: CourseCatalogRow): Course & {
  id: string;
  status: CourseCatalogRow["status"];
  updatedAt: string;
  assignmentSummary: { assigned: number; inProgress: number; completed: number };
} {
  const fallback = getCourse(row.slug);
  const minutes = Number(row.duration_minutes || 0);
  const course: Course = {
    slug: row.slug,
    title: row.title,
    instructor: fallback?.instructor || "JewelLink",
    category: row.category || fallback?.category || "Training",
    durationLabel: fallback?.durationLabel || courseDurationLabel(minutes),
    blurb: row.description || fallback?.blurb || "",
    skills: fallback?.skills || [],
    accent: fallback?.accent || "#123FB9",
    icon: fallback?.icon || "platform",
    progress: fallback?.progress || 0,
    certificate: fallback?.certificate || "Participant badge added to your resume on completion.",
    modules: fallback?.modules || [],
  };
  return {
    ...course,
    id: row.id,
    status: row.status,
    updatedAt: row.updated_at,
    assignmentSummary: {
      assigned: Number(row.assigned_count || 0),
      inProgress: Number(row.in_progress_count || 0),
      completed: Number(row.completed_count || 0),
    },
  };
}

export async function listPostgresCourses(input: { status?: CourseCatalogRow["status"] | null } = {}) {
  const result = await getPostgresPool().query<CourseCatalogRow>(
    `
      select
        c.id,
        c.slug,
        c.title,
        c.category,
        c.duration_minutes,
        c.description,
        c.status,
        c.updated_at::text,
        count(ca.id)::text as assigned_count,
        count(ca.id) filter (where ca.status = 'in_progress')::text as in_progress_count,
        count(ca.id) filter (where ca.status = 'completed')::text as completed_count
      from courses c
      left join course_assignments ca on ca.course_id = c.id
      where ($1::text is null or c.status = $1)
      group by c.id
      order by c.title asc
    `,
    [input.status || null],
  );
  return result.rows.map(mapPostgresCourse);
}

export async function getPostgresCourseDetail(slug: string) {
  const result = await getPostgresPool().query<CourseCatalogRow>(
    `
      select
        c.id,
        c.slug,
        c.title,
        c.category,
        c.duration_minutes,
        c.description,
        c.status,
        c.updated_at::text,
        count(ca.id)::text as assigned_count,
        count(ca.id) filter (where ca.status = 'in_progress')::text as in_progress_count,
        count(ca.id) filter (where ca.status = 'completed')::text as completed_count
      from courses c
      left join course_assignments ca on ca.course_id = c.id
      where c.slug = $1
      group by c.id
      limit 1
    `,
    [slug],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return mapPostgresCourse(row);
}

async function queryPostgresCourseAssignmentsWithClient(client: PoolClient, input: ListPostgresCourseAssignmentsInput & { assignmentId?: string }) {
  const normalizedStatus = labelAssignmentStatusToDb(input.status);
  const recipientQuery = input.recipientId?.trim().toLowerCase() || "";
  const result = await client.query<CourseAssignmentRow>(
    `
      select
        ca.id,
        ca.store_id,
        ca.course_id,
        c.slug as course_slug,
        c.title as course_title,
        ca.recipient_type,
        ca.recipient_id,
        coalesce(ap.full_name, tm.name) as recipient_name,
        ap.email as recipient_email,
        ca.application_id,
        ca.team_member_id,
        ca.assigned_by_user_id,
        ca.package_name,
        ca.status,
        ca.progress_percent,
        ca.source,
        ca.assigned_at::text,
        ca.due_at::text,
        ca.completed_at::text,
        ca.last_activity_at::text,
        cc.id as credential_id,
        case
          when ca.recipient_type = 'team_member' then tm.location_id
          else resource_location.location_id
        end as resource_location
      from course_assignments ca
      join courses c on c.id = ca.course_id
      left join applicant_profiles ap on ap.id = ca.recipient_id and ca.recipient_type = 'applicant'
      left join team_members tm on tm.id = ca.team_member_id and ca.recipient_type = 'team_member'
      left join applications a on a.id = ca.application_id and ca.recipient_type = 'applicant'
      left join public_jobs pj on pj.id = a.job_id
      ${resolvedJobLocationJoin("pj.location", "ca.store_id", "resource_location")}
      left join course_credentials cc on cc.course_assignment_id = ca.id
      where ($1::text is null or ca.store_id = $1)
        and ($2::text is null or c.slug = $2)
        and ($3::text is null or ca.status = $3)
        and ($4::text is null or ca.id = $4)
        and (
          $5::text = ''
          or lower(ca.id) = $5
          or lower(ca.recipient_id) = $5
          or lower(coalesce(ca.application_id, '')) = $5
          or lower(coalesce(ca.team_member_id, '')) = $5
          or lower(coalesce(ap.email, '')) = $5
          or ${slugExpression("coalesce(ap.full_name, tm.name, '')")} = $5
        )
      order by ca.last_activity_at desc
    `,
    [input.storeId ?? null, input.courseSlug ?? null, normalizedStatus ?? null, input.assignmentId ?? null, recipientQuery],
  );
  return result.rows.map(mapCourseAssignment);
}

async function queryPostgresCourseAssignments(input: ListPostgresCourseAssignmentsInput & { assignmentId?: string }) {
  const client = await getPostgresPool().connect();
  try {
    return await queryPostgresCourseAssignmentsWithClient(client, input);
  } finally {
    client.release();
  }
}

export async function getPostgresInterviewRsvpScope(interviewId: string) {
  const result = await getPostgresPool().query<{
    store_id: string;
    recipient_email: string | null;
    resource_location: string | null;
  }>(
    `
      select i.store_id, ap.email as recipient_email,
             resource_location.location_id as resource_location
      from interviews i
      join applications a on a.id = i.application_id
      join applicant_profiles ap on ap.id = a.applicant_profile_id
      left join public_jobs pj on pj.id = a.job_id
      ${resolvedJobLocationJoin("pj.location", "a.store_id", "resource_location")}
      where i.id = $1
      limit 1
    `,
    [interviewId],
  );
  const row = result.rows[0];
  return row ? {
    storeId: row.store_id,
    recipientEmail: row.recipient_email || undefined,
    resourceLocation: row.resource_location || undefined,
  } : undefined;
}

export async function listPostgresCourseAssignments(input: ListPostgresCourseAssignmentsInput = {}) {
  return queryPostgresCourseAssignments(input);
}

export async function listPostgresApplicantTraining(email?: string | null) {
  const normalizedEmail = normalizeEmail(email || "maya.chen@email.com");
  return queryPostgresCourseAssignments({ recipientId: normalizedEmail });
}

export async function getPostgresCourseAssignment(assignmentId: string) {
  const items = await queryPostgresCourseAssignments({ assignmentId });
  return items[0];
}

export async function getPostgresCourseAssignmentStoreId(assignmentId: string) {
  const result = await getPostgresPool().query<{ store_id: string }>(
    "select store_id from course_assignments where id = $1 limit 1",
    [assignmentId],
  );
  return result.rows[0]?.store_id;
}

export async function getPostgresCourseTestAttemptStoreId(attemptId: string) {
  const result = await getPostgresPool().query<{ store_id: string }>(
    `select ca.store_id
       from course_test_attempts cta
       join course_assignments ca on ca.id = cta.assignment_id
      where cta.id = $1
      limit 1`,
    [attemptId],
  );
  return result.rows[0]?.store_id;
}

async function getPostgresCourseCompletionTestInternal(courseSlug: string) {
  const testResult = await getPostgresPool().query<CourseTestRow>(
    `
      select
        ct.id,
        ct.course_id,
        c.slug as course_slug,
        c.title as course_title,
        ct.title,
        ct.passing_correct_count,
        ct.question_count,
        ct.status,
        ct.updated_at::text
      from course_tests ct
      join courses c on c.id = ct.course_id
      where c.slug = $1
        and ct.status = 'published'
      limit 1
    `,
    [courseSlug],
  );
  const test = testResult.rows[0];
  if (!test) return undefined;

  const questionResult = await getPostgresPool().query<CourseTestQuestionRow>(
    `
      select id, course_test_id, prompt, sort_order, status
      from course_test_questions
      where course_test_id = $1
        and status = 'published'
      order by sort_order, id
    `,
    [test.id],
  );
  const answerResult = await getPostgresPool().query<CourseTestAnswerRow>(
    `
      select cta.id, cta.question_id, cta.label, cta.sort_order, cta.is_correct
      from course_test_answers cta
      join course_test_questions ctq on ctq.id = cta.question_id
      where ctq.course_test_id = $1
      order by ctq.sort_order, cta.sort_order, cta.id
    `,
    [test.id],
  );
  const answersByQuestionId = new Map<string, CourseTestAnswerRow[]>();
  for (const answerRow of answerResult.rows) {
    answersByQuestionId.set(answerRow.question_id, [...(answersByQuestionId.get(answerRow.question_id) || []), answerRow]);
  }
  return mapCourseCompletionTest(test, questionResult.rows, answersByQuestionId);
}

export async function listPostgresCourseCompletionTests() {
  const result = await getPostgresPool().query<CourseTestRow>(
    `
      select
        ct.id,
        ct.course_id,
        c.slug as course_slug,
        c.title as course_title,
        ct.title,
        ct.passing_correct_count,
        ct.question_count,
        ct.status,
        ct.updated_at::text
      from courses c
      left join course_tests ct on ct.course_id = c.id and ct.status = 'published'
      order by c.title asc
    `,
  );
  const rowsWithTests = result.rows.filter((row) => row.id);
  const questionsByTestId = new Map<string, CourseTestQuestionRow[]>();
  const answersByQuestionId = new Map<string, CourseTestAnswerRow[]>();

  if (rowsWithTests.length > 0) {
    const testIds = rowsWithTests.map((row) => row.id);
    const questionResult = await getPostgresPool().query<CourseTestQuestionRow>(
      `
        select id, course_test_id, prompt, sort_order, status
        from course_test_questions
        where course_test_id = any($1::text[])
          and status = 'published'
        order by course_test_id, sort_order, id
      `,
      [testIds],
    );
    for (const question of questionResult.rows) {
      questionsByTestId.set(question.course_test_id, [...(questionsByTestId.get(question.course_test_id) || []), question]);
    }

    const questionIds = questionResult.rows.map((question) => question.id);
    if (questionIds.length > 0) {
      const answerResult = await getPostgresPool().query<CourseTestAnswerRow>(
        `
          select id, question_id, label, sort_order, is_correct
          from course_test_answers
          where question_id = any($1::text[])
          order by question_id, sort_order, id
        `,
        [questionIds],
      );
      for (const answerRow of answerResult.rows) {
        answersByQuestionId.set(answerRow.question_id, [...(answersByQuestionId.get(answerRow.question_id) || []), answerRow]);
      }
    }
  }

  return result.rows.map((row) => ({
    courseSlug: row.course_slug,
    courseTitle: row.course_title,
    test: row.id ? publicCourseCompletionTest(mapCourseCompletionTest(row, questionsByTestId.get(row.id) || [], answersByQuestionId)) : null,
  }));
}

export async function getPostgresCourseCompletionTestForLearner(courseSlug: string) {
  const test = await getPostgresCourseCompletionTestInternal(courseSlug);
  return test ? publicCourseCompletionTest(test) : undefined;
}

export async function listPostgresCourseTestAttempts(input: { assignmentId?: string | null; courseSlug?: string | null } = {}) {
  const result = await getPostgresPool().query<CourseTestAttemptRow>(
    `
      select
        id,
        course_test_id,
        course_slug,
        assignment_id,
        recipient_id,
        started_at::text,
        completed_at::text,
        score_correct_count,
        score_percent,
        passed,
        answers
      from course_test_attempts
      where ($1::text is null or assignment_id = $1)
        and ($2::text is null or course_slug = $2)
      order by completed_at desc
    `,
    [input.assignmentId || null, input.courseSlug || null],
  );
  return result.rows.map(mapCourseTestAttempt);
}

export async function getPostgresCourseTestAttempt(attemptId: string) {
  const result = await getPostgresPool().query<CourseTestAttemptRow>(
    `
      select
        id,
        course_test_id,
        course_slug,
        assignment_id,
        recipient_id,
        started_at::text,
        completed_at::text,
        score_correct_count,
        score_percent,
        passed,
        answers
      from course_test_attempts
      where id = $1
      limit 1
    `,
    [attemptId],
  );
  return result.rows[0] ? mapCourseTestAttempt(result.rows[0]) : undefined;
}

export async function submitPostgresCourseTestAttempt(input: {
  courseSlug: string;
  assignmentId?: string;
  recipientId?: string;
  answers: { questionId: string; answerId?: string; answerIndex?: number }[];
}) {
  const test = await getPostgresCourseCompletionTestInternal(input.courseSlug);
  if (!test) return undefined;

  const assignment = input.assignmentId ? await getPostgresCourseAssignment(input.assignmentId) : undefined;
  const timestamp = new Date().toISOString();
  const scoredAnswers = test.questions.map((question) => {
    const submitted = input.answers.find((item) => item.questionId === question.id);
    const selected =
      submitted?.answerId !== undefined
        ? question.answers.find((item) => item.id === submitted.answerId)
        : submitted?.answerIndex !== undefined
          ? question.answers[submitted.answerIndex]
          : undefined;
    return {
      questionId: question.id,
      answerId: selected?.id,
      answerIndex: selected ? question.answers.findIndex((item) => item.id === selected.id) : submitted?.answerIndex,
      correct: Boolean(selected?.isCorrect),
    };
  });
  const scoreCorrectCount = scoredAnswers.filter((item) => item.correct).length;
  const scorePercent = Math.round((scoreCorrectCount / Math.max(test.questionCount, 1)) * 100);
  const passed = scoreCorrectCount >= test.passingCorrectCount;
  const attemptId = id("course-test-attempt");

  await getPostgresPool().query(
    `
      insert into course_test_attempts (
        id, course_test_id, course_id, course_slug, assignment_id, recipient_id, started_at, completed_at,
        score_correct_count, score_percent, passed, answers
      )
      values ($1, $2, (select id from courses where slug = $3 limit 1), $3, $4, $5, $6, $6, $7, $8, $9, $10::jsonb)
    `,
    [
      attemptId,
      test.id,
      test.courseSlug,
      input.assignmentId || null,
      assignment?.recipientId || input.recipientId || null,
      timestamp,
      scoreCorrectCount,
      scorePercent,
      passed,
      JSON.stringify(scoredAnswers),
    ],
  );

  if (passed && input.assignmentId) {
    await updatePostgresTrainingProgress({ assignmentId: input.assignmentId, progress: 100 });
  }

  const attempt = await getPostgresCourseTestAttempt(attemptId);
  if (!attempt) return undefined;

  return {
    attempt,
    test: publicCourseCompletionTest(test),
    assignment: input.assignmentId ? await getPostgresCourseAssignment(input.assignmentId) : undefined,
  };
}

export async function updatePostgresTrainingProgress(input: { assignmentId: string; progress: number }) {
  const bounded = Math.max(0, Math.min(100, Math.round(input.progress)));
  const status: CourseAssignmentRow["status"] = bounded >= 100 ? "completed" : bounded > 0 ? "in_progress" : "not_started";
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const assignmentResult = await client.query<CourseAssignmentRow & { resume_id: string | null }>(
      `
        select
          ca.id,
          ca.store_id,
          ca.course_id,
          c.slug as course_slug,
          c.title as course_title,
          ca.recipient_type,
          ca.recipient_id,
          ap.full_name as recipient_name,
          ap.email as recipient_email,
          ca.application_id,
          ca.team_member_id,
          ca.assigned_by_user_id,
          ca.package_name,
          ca.status,
          ca.progress_percent,
          ca.source,
          ca.assigned_at::text,
          ca.due_at::text,
          ca.completed_at::text,
          ca.last_activity_at::text,
          cc.id as credential_id,
          ar.id as resume_id
        from course_assignments ca
        join courses c on c.id = ca.course_id
        left join applicant_profiles ap on ap.id = ca.recipient_id and ca.recipient_type = 'applicant'
        left join applicant_resumes ar on ar.applicant_profile_id = ap.id
        left join course_credentials cc on cc.course_assignment_id = ca.id
        where ca.id = $1
        for update of ca
      `,
      [input.assignmentId],
    );
    const assignment = assignmentResult.rows[0];
    if (!assignment) {
      await client.query("rollback");
      return undefined;
    }

    const timestamp = new Date().toISOString();
    const completedAt = status === "completed" ? timestamp : null;
    await client.query(
      `
        update course_assignments
        set progress_percent = $1,
            status = $2,
            completed_at = coalesce($3, completed_at),
            last_activity_at = $4
        where id = $5
      `,
      [bounded, status, completedAt, timestamp, input.assignmentId],
    );

    let credentialId = assignment.credential_id;
    if (status === "completed" && assignment.recipient_type === "applicant" && assignment.resume_id) {
      credentialId = assignment.credential_id || `course-credential-${slugify(input.assignmentId)}`;
      await client.query(
        `
          insert into course_credentials (
            id, course_assignment_id, applicant_resume_id, course_id, issuer, issued_at, metadata
          )
          values ($1, $2, $3, $4, 'JewelHire', $5, $6::jsonb)
          on conflict (course_assignment_id) do update set
            applicant_resume_id = excluded.applicant_resume_id,
            course_id = excluded.course_id,
            issued_at = excluded.issued_at,
            metadata = excluded.metadata
        `,
        [
          credentialId,
          input.assignmentId,
          assignment.resume_id,
          assignment.course_id,
          timestamp,
          JSON.stringify({ display: `${assignment.course_title} completion` }),
        ],
      );
      await client.query(
        `
          update applicant_resumes
          set course_credential_ids = (
                select jsonb_agg(distinct value)
                from jsonb_array_elements_text(course_credential_ids || to_jsonb($1::text)) as value
              ),
              updated_at = $2
          where id = $3
        `,
        [credentialId, timestamp, assignment.resume_id],
      );
    }

    if (status === "completed" && assignment.application_id) {
      await reconcilePostgresJewelCertCompletionWithClient(client, { applicationId: assignment.application_id });
    }

    await client.query("commit");
    return getPostgresCourseAssignment(input.assignmentId);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function resolvePostgresTrainingCourse(client: PoolClient, courseSlugOrId?: string | null) {
  if (!courseSlugOrId) return undefined;
  const normalized = courseSlugOrId.trim().toLowerCase();
  const result = await client.query<{ id: string; slug: string; title: string }>(
    `
      select id, slug, title
      from courses
      where id = $1
        or slug = $1
        or lower(title) = $1
      limit 1
    `,
    [normalized],
  );
  return result.rows[0];
}

async function resolvePostgresTrainingRecipient(client: PoolClient, storeId: string, recipientId: string) {
  const normalized = recipientId.trim().toLowerCase();
  if (!normalized) return undefined;

  const applicantResult = await client.query<{
    recipient_id: string;
    recipient_name: string;
    recipient_email: string;
    application_id: string | null;
  }>(
    `
      select
        ap.id as recipient_id,
        ap.full_name as recipient_name,
        ap.email as recipient_email,
        a.id as application_id
      from applicant_profiles ap
      join applications a on a.applicant_profile_id = ap.id
      where a.store_id = $1
        and (
          a.id = $2
          or ap.id = $2
          or ap.email_normalized = $2
          or ${slugExpression("ap.full_name")} = $2
        )
      order by a.last_activity_at desc
      limit 1
    `,
    [storeId, normalized],
  );
  const applicant = applicantResult.rows[0];
  if (applicant) {
    return {
      recipientType: "applicant" as const,
      recipientId: applicant.recipient_id,
      recipientName: applicant.recipient_name,
      recipientEmail: applicant.recipient_email,
      applicationId: applicant.application_id || undefined,
      teamMemberId: undefined,
    };
  }

  const teamResult = await client.query<{
    recipient_id: string;
    recipient_name: string;
  }>(
    `
      select id as recipient_id, name as recipient_name
      from team_members
      where store_id = $1
        and status <> 'removed'
        and (
          id = $2
          or lower(coalesce(jewellink_team_member_id, '')) = $2
          or ${slugExpression("name")} = $2
        )
      order by created_at desc
      limit 1
    `,
    [storeId, normalized],
  );
  const teamMember = teamResult.rows[0];
  if (teamMember) {
    return {
      recipientType: "team_member" as const,
      recipientId: teamMember.recipient_id,
      recipientName: teamMember.recipient_name,
      recipientEmail: undefined,
      applicationId: undefined,
      teamMemberId: teamMember.recipient_id,
    };
  }

  return undefined;
}

export async function createPostgresCourseAssignments(input: CreatePostgresCourseAssignmentsInput) {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const course = await resolvePostgresTrainingCourse(client, input.courseSlug || input.courseId);
    if (!course) {
      await client.query("rollback");
      return { assignments: [], skipped: input.recipientIds, error: "Course not found" };
    }

    const timestamp = new Date().toISOString();
    const assignmentIds: string[] = [];
    const skipped: string[] = [];

    for (const rawRecipientId of input.recipientIds) {
      const recipient = await resolvePostgresTrainingRecipient(client, input.storeId, String(rawRecipientId));
      if (!recipient) {
        skipped.push(String(rawRecipientId));
        continue;
      }

      const existingResult = await client.query<{ id: string }>(
        `
          select id
          from course_assignments
          where store_id = $1
            and course_id = $2
            and recipient_type = $3
            and recipient_id = $4
            and status not in ('completed', 'expired', 'waived')
          order by assigned_at desc
          limit 1
        `,
        [input.storeId, course.id, recipient.recipientType, recipient.recipientId],
      );
      const existingId = existingResult.rows[0]?.id;
      if (existingId) {
        await client.query(
          `
            update course_assignments
            set due_at = coalesce($1, due_at),
                last_activity_at = $2
            where id = $3
          `,
          [input.dueAt || null, timestamp, existingId],
        );
        assignmentIds.push(existingId);
        continue;
      }

      const assignmentId = id("course-assignment");
      await client.query(
        `
          insert into course_assignments (
            id, store_id, course_id, recipient_type, recipient_id, application_id, team_member_id,
            assigned_by_user_id, package_name, status, progress_percent, source, assigned_at, due_at,
            last_activity_at
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            (select id from users where id = $8 limit 1),
            $9,
            'not_started',
            0,
            $10,
            $11,
            $12,
            $11
          )
        `,
        [
          assignmentId,
          input.storeId,
          course.id,
          recipient.recipientType,
          recipient.recipientId,
          recipient.applicationId || null,
          recipient.teamMemberId || null,
          input.actorUserId,
          input.packageName?.trim() || "Manager-assigned training",
          input.source || "manager",
          timestamp,
          input.dueAt || null,
        ],
      );

      if (recipient.applicationId) {
        const noteId = id("note");
        await client.query(
          `
            insert into applicant_notes (
              id, application_id, store_id, author_user_id, body, visibility, note_type, created_at, updated_at
            )
            values (
              $1,
              $2,
              $3,
              (select id from users where id = $4 limit 1),
              $5,
              'store_internal',
              'general',
              $6,
              $6
            )
          `,
          [noteId, recipient.applicationId, input.storeId, input.actorUserId, `Assigned training: ${course.title}`, timestamp],
        );
      }

      assignmentIds.push(assignmentId);
    }

    const assignments = [];
    for (const assignmentId of assignmentIds) {
      const [assignment] = await queryPostgresCourseAssignmentsWithClient(client, { assignmentId });
      if (assignment) assignments.push(assignment);
    }

    await client.query("commit");
    return {
      assignments,
      skipped,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePostgresCourseAssignment(input: UpdatePostgresCourseAssignmentInput) {
  if (input.progress !== undefined) {
    await updatePostgresTrainingProgress({ assignmentId: input.assignmentId, progress: input.progress });
  }

  const status = labelAssignmentStatusToDb(input.status);
  if (status === "completed") {
    await updatePostgresTrainingProgress({ assignmentId: input.assignmentId, progress: 100 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  if (status && status !== "completed") {
    values.push(status);
    updates.push(`status = $${values.length}`);
  }
  if (input.dueAt !== undefined) {
    values.push(input.dueAt || null);
    updates.push(`due_at = $${values.length}`);
  }
  if (input.packageName !== undefined) {
    values.push(input.packageName.trim() || "Manager-assigned training");
    updates.push(`package_name = $${values.length}`);
  }

  if (updates.length > 0) {
    values.push(new Date().toISOString());
    updates.push(`last_activity_at = $${values.length}`);
    values.push(input.assignmentId);
    await getPostgresPool().query(
      `
        update course_assignments
        set ${updates.join(", ")}
        where id = $${values.length}
      `,
      values,
    );
  }

  return getPostgresCourseAssignment(input.assignmentId);
}

export async function deletePostgresCourseAssignment(assignmentId: string) {
  const assignment = await getPostgresCourseAssignment(assignmentId);
  if (!assignment) return undefined;
  await getPostgresPool().query("delete from course_assignments where id = $1", [assignmentId]);
  return assignment;
}

export async function updatePostgresApplicationStage(
  input: UpdatePostgresApplicationStageInput,
): Promise<ApplicationDetail | undefined> {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const applicationResult = await client.query<{
      id: string;
      store_id: string;
      company_id: string;
      stage: ApplicationStage;
    }>(
      `
        select a.id, a.store_id, s.company_id, a.stage
        from applications a
        join stores s on s.id = a.store_id
        where a.id = $1
          and a.store_id = $2
        for update
      `,
      [input.applicationId, input.storeId],
    );
    const application = applicationResult.rows[0];
    if (!application) {
      await client.query("rollback");
      return undefined;
    }

    const timestamp = new Date().toISOString();
    const eventId = id("event");
    const domainEventId = id("event");
    await client.query(
      `
        update applications
        set stage = $1,
            status_reason = $2,
            last_activity_at = $3,
            updated_at = $3
        where id = $4
          and store_id = $5
      `,
      [input.toStage, input.reason, timestamp, input.applicationId, input.storeId],
    );
    await client.query(
      `
        insert into application_stage_events (
          id, application_id, store_id, from_stage, to_stage, actor_user_id, reason, metadata, created_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          (select id from users where id = $6 limit 1),
          $7,
          $8::jsonb,
          $9
        )
      `,
      [
        eventId,
        input.applicationId,
        input.storeId,
        application.stage,
        input.toStage,
        input.actorUserId,
        input.reason,
        JSON.stringify({ source: "store_pipeline" }),
        timestamp,
      ],
    );
    await client.query(
      `
        insert into domain_events (
          id, store_id, company_id, actor_user_id, event_type, subject_type, subject_id, payload, created_at
        )
        values (
          $1,
          $2,
          $3,
          (select id from users where id = $4 limit 1),
          'application.stage_changed',
          'application',
          $5,
          $6::jsonb,
          $7
        )
      `,
      [
        domainEventId,
        input.storeId,
        application.company_id,
        input.actorUserId,
        input.applicationId,
        JSON.stringify({ fromStage: application.stage, toStage: input.toStage, reason: input.reason }),
        timestamp,
      ],
    );

    await client.query("commit");
    return getPostgresApplicationDetail({ applicationId: input.applicationId, storeId: input.storeId });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function getOpenPostgresPublicJob(client: PoolClient, storeSlug: string, jobId: string) {
  const result = await client.query<PublicJobRow & { company_id: string }>(
    `
      select
        pj.id,
        pj.store_id,
        pj.public_page_id,
        s.company_id,
        pj.title,
        pj.location,
        pj.employment_type,
        pj.compensation_summary,
        pj.description,
        pj.requirements,
        pj.ideal_gemmatch_mix,
        pj.required_assessment_ids,
        pj.required_course_ids,
        pj.status,
        pj.opened_at::text,
        pj.closed_at::text,
        pj.view_count,
        pj.apply_click_count
      from store_public_pages spp
      join stores s on s.id = spp.store_id
      join public_jobs pj on pj.store_id = s.id
      where spp.slug = $1
        and spp.status = 'published'
        and s.status = 'active'
        and (pj.id = $2 or pj.id = concat('job-', $2))
        and pj.status = 'open'
      limit 1
    `,
    [storeSlug, jobId],
  );
  return result.rows[0];
}

export async function incrementPostgresPublicJobView(storeSlug: string, jobId: string) {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const job = await getOpenPostgresPublicJob(client, storeSlug, jobId);
    if (!job) {
      await client.query("rollback");
      return undefined;
    }
    const result = await client.query<PublicJobRow>(
      `
        update public_jobs
        set view_count = view_count + 1
        where id = $1
        returning
          id,
          store_id,
          public_page_id,
          slug,
          title,
          location,
          employment_type,
          compensation_summary,
          description,
          requirements,
          ideal_gemmatch_mix,
          required_assessment_ids,
          required_course_ids,
          status,
          opened_at::text,
          closed_at::text,
          created_at::text,
          updated_at::text,
          view_count,
          apply_click_count
      `,
      [job.id],
    );
    await client.query("commit");
    const row = result.rows[0];
    return row ? mapPublicJob(row) : undefined;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function createPostgresPublicApplication(
  input: CreatePostgresPublicApplicationInput,
): Promise<CreatePostgresPublicApplicationResult> {
  const name = input.profile.name?.trim() || "";
  const email = normalizeEmail(input.profile.email);
  if (!name || !email || !email.includes("@")) {
    return { error: "Applicant name and valid email are required" };
  }
  if (!input.jobId) {
    return { error: "Public job not found" };
  }

  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const jobRow = await getOpenPostgresPublicJob(client, input.storeSlug, input.jobId);
    if (!jobRow) {
      await client.query("rollback");
      return { error: "Public job not found" };
    }

    if (input.submissionKeyHash) {
      await client.query("select pg_advisory_xact_lock(hashtext($1))", [input.submissionKeyHash]);
      const existing = await client.query<{ id: string }>(
        "select id from applications where public_submission_key_hash = $1 limit 1",
        [input.submissionKeyHash],
      );
      if (existing.rows[0]) {
        await client.query("commit");
        return { applicationId: existing.rows[0].id, duplicate: true };
      }
    }

    const timestamp = new Date().toISOString();
    const profileId = id("profile");
    const resumeId = id("resume");
    const applicationId = id("app");
    const stageEventId = id("event");
    const domainEventId = id("event");
    const profile: ApplicantProfileRecord = {
      id: profileId,
      fullName: name,
      email,
      phone: input.profile.phone?.trim() || "",
      location: input.profile.location?.trim() || "",
      resumeHeadline: input.profile.headline?.trim() || jobRow.title,
      summary: input.profile.summary?.trim() || "",
      visibility: "private_store_application",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const resume: ApplicantResumeRecord = {
      id: resumeId,
      applicantProfileId: profileId,
      summary: profile.summary,
      workExperience: toList(input.profile.experience),
      education: toList(input.profile.education),
      skills: toList(input.profile.skills),
      portfolioLinks: [],
      courseCredentialIds: [],
      updatedAt: timestamp,
    };
    const application: ApplicationRecord = {
      id: applicationId,
      storeId: jobRow.store_id,
      jobId: jobRow.id,
      applicantProfileId: profileId,
      source: "public_store_page",
      stage: "applied",
      submittedAt: timestamp,
      lastActivityAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await client.query(
      `
        insert into applicant_profiles (
          id, full_name, email, email_normalized, phone, location, resume_headline, summary,
          visibility, created_at, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, 'private_store_application', $9, $9)
      `,
      [profile.id, profile.fullName, profile.email, email, profile.phone, profile.location, profile.resumeHeadline, profile.summary, timestamp],
    );
    await client.query(
      `
        insert into applicant_resumes (
          id, applicant_profile_id, summary, work_experience, education, skills, portfolio_links,
          course_credential_ids, created_at, updated_at
        )
        values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, '[]'::jsonb, '[]'::jsonb, $7, $7)
      `,
      [
        resume.id,
        resume.applicantProfileId,
        resume.summary,
        JSON.stringify(resume.workExperience),
        JSON.stringify(resume.education),
        JSON.stringify(resume.skills),
        timestamp,
      ],
    );
    await client.query(
      `
        insert into applications (
          id, store_id, job_id, applicant_profile_id, source, stage, submitted_at,
          last_activity_at, created_at, updated_at, public_submission_key_hash
        )
        values ($1, $2, $3, $4, 'public_store_page', 'applied', $5, $5, $5, $5, $6)
      `,
      [application.id, application.storeId, application.jobId, application.applicantProfileId, timestamp, input.submissionKeyHash || null],
    );
    if (input.attachment) {
      await client.query(
        `
          insert into application_attachments (
            id, application_id, store_id, kind, original_filename, mime_type,
            file_size_bytes, sha256, content, created_at
          )
          values ($1, $2, $3, 'resume', $4, $5, $6, $7, $8, $9)
        `,
        [
          id("attachment"),
          application.id,
          application.storeId,
          input.attachment.originalFilename,
          input.attachment.mimeType,
          input.attachment.fileSizeBytes,
          input.attachment.sha256,
          input.attachment.content,
          timestamp,
        ],
      );
    }
    await client.query(
      `
        insert into application_stage_events (
          id, application_id, store_id, from_stage, to_stage, actor_user_id, reason, metadata, created_at
        )
        values ($1, $2, $3, null, 'applied', null, 'Application submitted from public store page', $4::jsonb, $5)
      `,
      [stageEventId, application.id, application.storeId, JSON.stringify({ source: "public_store_page" }), timestamp],
    );
    await client.query(
      `
        insert into domain_events (
          id, store_id, company_id, actor_user_id, event_type, subject_type, subject_id, payload, created_at
        )
        values ($1, $2, $3, null, 'application.created', 'application', $4, $5::jsonb, $6)
      `,
      [
        domainEventId,
        application.storeId,
        jobRow.company_id,
        application.id,
        JSON.stringify({ source: "public_store_page", jobId: application.jobId, applicantProfileId: profile.id }),
        timestamp,
      ],
    );
    await client.query("update public_jobs set apply_click_count = apply_click_count + 1 where id = $1", [application.jobId]);

    await client.query("commit");
    return {
      applicationId,
      application,
      profile,
      resume,
      job: mapPublicJob(jobRow),
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
