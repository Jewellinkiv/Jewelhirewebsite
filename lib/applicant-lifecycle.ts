// Backend-shaped Phase 1 applicant lifecycle seed data.
// This mirrors docs/applicant-lifecycle-model.md and keeps applicants store-scoped.

import { FitTier, ProfileCode } from "./gemmatch";

export type PublicPageStatus = "draft" | "published" | "paused";
export type PublicJobStatus = "draft" | "open" | "paused" | "closed";
export type ApplicationSource = "public_store_page" | "manual_store_entry" | "referral";
export type ApplicationStage = "applied" | "jewelcert" | "gemmatch" | "interview" | "offer" | "hired" | "rejected" | "withdrawn";
export type InviteStatus = "draft" | "sent" | "started" | "completed" | "expired" | "cancelled";
export type InterviewStatus = "scheduled" | "completed" | "cancelled" | "no_show";
export type InterviewLocationType = "in_store" | "phone" | "video";
export type NoteType = "general" | "screening" | "interview" | "hire_handoff";
export type HireSyncStatus = "pending" | "synced" | "failed" | "cancelled";

export interface StorePublicPageRecord {
  id: string;
  storeId: string;
  slug: string;
  headline: string;
  about: string;
  benefits: string[];
  reviewSummary: { rating: number; count: number };
  status: PublicPageStatus;
  publishedAt?: string;
  updatedAt: string;
}

export interface PublicJobRecord {
  id: string;
  storeId: string;
  publicPageId: string;
  title: string;
  location: string;
  employmentType: "Full-time" | "Part-time";
  compensationSummary: string;
  description: string;
  requirements: string[];
  idealGemMatchMix: ProfileCode[];
  requiredAssessmentIds: string[];
  requiredCourseIds: string[];
  status: PublicJobStatus;
  openedAt?: string;
  closedAt?: string;
}

export interface ApplicantProfileRecord {
  id: string;
  ownerUserId?: string;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  resumeHeadline: string;
  summary: string;
  visibility: "private_store_application";
  createdAt: string;
  updatedAt: string;
}

export interface ApplicantResumeRecord {
  id: string;
  applicantProfileId: string;
  summary: string;
  workExperience: string[];
  education: string[];
  skills: string[];
  portfolioLinks: string[];
  courseCredentialIds: string[];
  updatedAt: string;
}

export interface ApplicationRecord {
  id: string;
  storeId: string;
  jobId: string;
  applicantProfileId: string;
  source: ApplicationSource;
  stage: ApplicationStage;
  statusReason?: string;
  currentOwnerUserId?: string;
  submittedAt: string;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationStageEventRecord {
  id: string;
  applicationId: string;
  fromStage?: ApplicationStage;
  toStage: ApplicationStage;
  actorUserId: string;
  reason: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface JewelCertInviteRecord {
  id: string;
  applicationId: string;
  storeId: string;
  assessmentPackageId: string;
  sentByUserId: string;
  sentToEmail: string;
  status: InviteStatus;
  expiresAt?: string;
  sentAt?: string;
  completedAt?: string;
}

export interface AssessmentAttemptLinkRecord {
  id: string;
  applicationId: string;
  jewelcertInviteId: string;
  assessmentAttemptId: string;
  assessmentType: "knowledge_check" | "trait_profile";
  scoreSummary: string;
  completedAt: string;
}

export interface GemMatchInviteRecord {
  id: string;
  applicationId: string;
  storeId: string;
  sentByUserId: string;
  status: InviteStatus;
  resultProfileCode?: ProfileCode;
  fitRating?: FitTier;
  completedAt?: string;
  createdAt: string;
}

export interface InterviewRecord {
  id: string;
  applicationId: string;
  storeId: string;
  scheduledByUserId: string;
  interviewerUserIds: string[];
  startsAt: string;
  endsAt: string;
  locationType: InterviewLocationType;
  locationDetails: string;
  status: InterviewStatus;
  outcome?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicantNoteRecord {
  id: string;
  applicationId: string;
  storeId: string;
  authorUserId: string;
  body: string;
  visibility: "store_internal";
  noteType: NoteType;
  createdAt: string;
  updatedAt: string;
}

export interface HireToJewelLinkSyncRecord {
  id: string;
  applicationId: string;
  storeId: string;
  jewellinkTeamMemberId?: string;
  syncedByUserId: string;
  syncStatus: HireSyncStatus;
  payloadSnapshot: {
    fullName: string;
    role: string;
    gemmatchProfile?: ProfileCode;
    courseCredentialIds: string[];
  };
  errorMessage?: string;
  createdAt: string;
  syncedAt?: string;
}

export interface ApplicationDetail {
  application: ApplicationRecord;
  profile: ApplicantProfileRecord;
  resume?: ApplicantResumeRecord;
  job?: PublicJobRecord;
  stageEvents: ApplicationStageEventRecord[];
  jewelcertInvites: JewelCertInviteRecord[];
  assessmentAttempts: AssessmentAttemptLinkRecord[];
  gemmatchInvites: GemMatchInviteRecord[];
  interviews: InterviewRecord[];
  notes: ApplicantNoteRecord[];
  hireSync?: HireToJewelLinkSyncRecord;
}

export const DEFAULT_STORE_ID = "store-sissys-little-rock";
export const DEFAULT_PUBLIC_PAGE_ID = "public-page-sissys-careers";

export const STORE_PUBLIC_PAGES: StorePublicPageRecord[] = [
  {
    id: DEFAULT_PUBLIC_PAGE_ID,
    storeId: DEFAULT_STORE_ID,
    slug: "sissys-log-cabin-careers",
    headline: "Build a career in fine jewelry",
    about: "A family-owned fine jeweler hiring relationship-driven people for sales, service, and craftsmanship roles.",
    benefits: ["Health insurance", "401(k)", "Commission", "Paid holidays", "Employee discounts", "On-site training"],
    reviewSummary: { rating: 4.8, count: 42 },
    status: "published",
    publishedAt: "2026-06-01T14:00:00.000Z",
    updatedAt: "2026-06-20T15:35:00.000Z",
  },
];

export const PUBLIC_JOBS: PublicJobRecord[] = [
  {
    id: "job-luxury-sales-associate",
    storeId: DEFAULT_STORE_ID,
    publicPageId: DEFAULT_PUBLIC_PAGE_ID,
    title: "Luxury Jewelry Sales Associate",
    location: "Little Rock, AR",
    employmentType: "Full-time",
    compensationSummary: "$60,000 - $85,000",
    description: "Deliver a luxury shopping experience, build a personal client book, and grow with structured jewelry training.",
    requirements: ["Client-facing sales experience", "Strong follow-up habits", "Weekend availability"],
    idealGemMatchMix: ["C", "F"],
    requiredAssessmentIds: ["sales-personality", "jewelry-basic-knowledge"],
    requiredCourseIds: ["jewellink-premium-how-to"],
    status: "open",
    openedAt: "2026-06-01T14:00:00.000Z",
  },
  {
    id: "job-sales-manager",
    storeId: DEFAULT_STORE_ID,
    publicPageId: DEFAULT_PUBLIC_PAGE_ID,
    title: "Sales Manager",
    location: "Little Rock, AR",
    employmentType: "Full-time",
    compensationSummary: "$75,000 - $125,000",
    description: "Coach a high-performing sales floor, drive clienteling, and help new associates ramp quickly.",
    requirements: ["Jewelry or luxury retail leadership", "Coaching experience", "Comfort with sales goals"],
    idealGemMatchMix: ["D", "C"],
    requiredAssessmentIds: ["sales-personality"],
    requiredCourseIds: [],
    status: "open",
    openedAt: "2026-06-05T14:00:00.000Z",
  },
  {
    id: "job-bench-jeweler",
    storeId: DEFAULT_STORE_ID,
    publicPageId: DEFAULT_PUBLIC_PAGE_ID,
    title: "Bench Jeweler / Repair Specialist",
    location: "Little Rock, AR",
    employmentType: "Full-time",
    compensationSummary: "$55,000 - $90,000",
    description: "Perform precision repair, sizing, and custom bench work for a quality-focused service department.",
    requirements: ["Bench jewelry experience", "Stone setting familiarity", "Quality control discipline"],
    idealGemMatchMix: ["F", "D"],
    requiredAssessmentIds: ["jewelry-basic-knowledge"],
    requiredCourseIds: [],
    status: "open",
    openedAt: "2026-06-08T14:00:00.000Z",
  },
];

export const APPLICANT_PROFILES: ApplicantProfileRecord[] = [
  {
    id: "profile-kate-pryor",
    fullName: "Kate Pryor",
    email: "kate.pryor@email.com",
    phone: "(501) 555-0111",
    location: "Conway, AR",
    resumeHeadline: "Client-focused retail associate",
    summary: "Three years in boutique retail with strong follow-up and warm client service.",
    visibility: "private_store_application",
    createdAt: "2026-06-22T13:15:00.000Z",
    updatedAt: "2026-06-22T13:28:00.000Z",
  },
  {
    id: "profile-bryan-lett",
    fullName: "Bryan Lett",
    email: "bryan.lett@email.com",
    phone: "(501) 555-0166",
    location: "Little Rock, AR",
    resumeHeadline: "Retail associate entering fine jewelry",
    summary: "Hard worker with customer-facing retail experience and interest in jewelry sales.",
    visibility: "private_store_application",
    createdAt: "2026-06-21T16:20:00.000Z",
    updatedAt: "2026-06-21T16:32:00.000Z",
  },
  {
    id: "profile-maya-chen",
    fullName: "Maya Chen",
    email: "maya.chen@email.com",
    phone: "(501) 555-0148",
    location: "Little Rock, AR",
    resumeHeadline: "Luxury retail clienteling specialist",
    summary: "Six years in luxury retail, clienteling, and relationship-driven sales.",
    visibility: "private_store_application",
    createdAt: "2026-06-17T15:10:00.000Z",
    updatedAt: "2026-06-20T18:45:00.000Z",
  },
  {
    id: "profile-devon-ross",
    fullName: "Devon Ross",
    email: "devon.ross@email.com",
    phone: "(501) 555-0192",
    location: "Little Rock, AR",
    resumeHeadline: "Bench jeweler and CAD designer",
    summary: "Nine years of bench jewelry, repair, CAD, and precision quality control.",
    visibility: "private_store_application",
    createdAt: "2026-06-19T12:05:00.000Z",
    updatedAt: "2026-06-22T09:10:00.000Z",
  },
  {
    id: "profile-ana-raper",
    fullName: "Ana Raper",
    email: "ana.raper@email.com",
    phone: "(501) 555-0177",
    location: "Little Rock, AR",
    resumeHeadline: "Relationship sales closer",
    summary: "Customer-facing sales background across automotive and retail with strong closing skills.",
    visibility: "private_store_application",
    createdAt: "2026-06-15T10:20:00.000Z",
    updatedAt: "2026-06-19T11:40:00.000Z",
  },
  {
    id: "profile-jess-wood",
    fullName: "Jess Wood",
    email: "jess.wood@email.com",
    phone: "(501) 555-0123",
    location: "Little Rock, AR",
    resumeHeadline: "Sales manager and team coach",
    summary: "Sales manager with a track record of building high-performing retail teams.",
    visibility: "private_store_application",
    createdAt: "2026-06-12T09:00:00.000Z",
    updatedAt: "2026-06-22T14:15:00.000Z",
  },
];

export const APPLICANT_RESUMES: ApplicantResumeRecord[] = [
  {
    id: "resume-kate-pryor",
    applicantProfileId: "profile-kate-pryor",
    summary: "Warm retail associate ready to move into fine jewelry.",
    workExperience: ["Sales Associate, Finch Boutique", "Client Service, Conway Gifts"],
    education: ["University of Central Arkansas"],
    skills: ["Customer service", "Follow-up", "POS", "Inventory care"],
    portfolioLinks: [],
    courseCredentialIds: [],
    updatedAt: "2026-06-22T13:28:00.000Z",
  },
  {
    id: "resume-maya-chen",
    applicantProfileId: "profile-maya-chen",
    summary: "Luxury retail associate with a repeat-client book and bridal sales experience.",
    workExperience: ["Senior Stylist, Hart & Lane", "Client Advisor, Bellamy Bridal"],
    education: ["BA Marketing, UALR"],
    skills: ["Clienteling", "Bridal consultation", "CRM follow-up", "Luxury service"],
    portfolioLinks: ["https://example.com/maya-client-book"],
    courseCredentialIds: ["course-credential-jewellink-premium-how-to"],
    updatedAt: "2026-06-20T18:45:00.000Z",
  },
  {
    id: "resume-devon-ross",
    applicantProfileId: "profile-devon-ross",
    summary: "Bench jeweler focused on precision repair, custom work, and documentation.",
    workExperience: ["Bench Jeweler, Oak Street Jewelers", "CAD Assistant, Studio North"],
    education: ["GIA Bench Jewelry coursework"],
    skills: ["Sizing", "Stone setting", "CAD", "Quality control"],
    portfolioLinks: ["https://example.com/devon-repairs"],
    courseCredentialIds: [],
    updatedAt: "2026-06-22T09:10:00.000Z",
  },
  {
    id: "resume-jess-wood",
    applicantProfileId: "profile-jess-wood",
    summary: "Sales leader who coaches with clear targets and clienteling habits.",
    workExperience: ["Assistant Manager, Lumen Fine Jewelry", "Sales Lead, Heritage Bridal"],
    education: ["Retail leadership certificate"],
    skills: ["Sales coaching", "Clienteling", "Pipeline management", "Team onboarding"],
    portfolioLinks: [],
    courseCredentialIds: ["course-credential-jewellink-premium-how-to"],
    updatedAt: "2026-06-22T14:15:00.000Z",
  },
];

export const APPLICATIONS: ApplicationRecord[] = [
  {
    id: "app-kate-pryor",
    storeId: DEFAULT_STORE_ID,
    jobId: "job-luxury-sales-associate",
    applicantProfileId: "profile-kate-pryor",
    source: "public_store_page",
    stage: "applied",
    submittedAt: "2026-06-22T13:30:00.000Z",
    lastActivityAt: "2026-06-22T13:30:00.000Z",
    createdAt: "2026-06-22T13:30:00.000Z",
    updatedAt: "2026-06-22T13:30:00.000Z",
  },
  {
    id: "app-bryan-lett",
    storeId: DEFAULT_STORE_ID,
    jobId: "job-luxury-sales-associate",
    applicantProfileId: "profile-bryan-lett",
    source: "public_store_page",
    stage: "jewelcert",
    currentOwnerUserId: "user-hiring-manager",
    submittedAt: "2026-06-21T16:35:00.000Z",
    lastActivityAt: "2026-06-22T09:00:00.000Z",
    createdAt: "2026-06-21T16:35:00.000Z",
    updatedAt: "2026-06-22T09:00:00.000Z",
  },
  {
    id: "app-maya-chen",
    storeId: DEFAULT_STORE_ID,
    jobId: "job-luxury-sales-associate",
    applicantProfileId: "profile-maya-chen",
    source: "public_store_page",
    stage: "interview",
    currentOwnerUserId: "user-hiring-manager",
    submittedAt: "2026-06-17T15:20:00.000Z",
    lastActivityAt: "2026-06-23T14:30:00.000Z",
    createdAt: "2026-06-17T15:20:00.000Z",
    updatedAt: "2026-06-23T14:30:00.000Z",
  },
  {
    id: "app-devon-ross",
    storeId: DEFAULT_STORE_ID,
    jobId: "job-bench-jeweler",
    applicantProfileId: "profile-devon-ross",
    source: "referral",
    stage: "gemmatch",
    currentOwnerUserId: "user-hiring-manager",
    submittedAt: "2026-06-19T12:10:00.000Z",
    lastActivityAt: "2026-06-22T09:30:00.000Z",
    createdAt: "2026-06-19T12:10:00.000Z",
    updatedAt: "2026-06-22T09:30:00.000Z",
  },
  {
    id: "app-ana-raper",
    storeId: DEFAULT_STORE_ID,
    jobId: "job-luxury-sales-associate",
    applicantProfileId: "profile-ana-raper",
    source: "public_store_page",
    stage: "rejected",
    statusReason: "Team fit concern for current floor mix",
    currentOwnerUserId: "user-hiring-manager",
    submittedAt: "2026-06-15T10:25:00.000Z",
    lastActivityAt: "2026-06-20T11:00:00.000Z",
    createdAt: "2026-06-15T10:25:00.000Z",
    updatedAt: "2026-06-20T11:00:00.000Z",
  },
  {
    id: "app-jess-wood",
    storeId: DEFAULT_STORE_ID,
    jobId: "job-sales-manager",
    applicantProfileId: "profile-jess-wood",
    source: "manual_store_entry",
    stage: "hired",
    currentOwnerUserId: "user-hiring-manager",
    submittedAt: "2026-06-12T09:15:00.000Z",
    lastActivityAt: "2026-06-22T14:30:00.000Z",
    createdAt: "2026-06-12T09:15:00.000Z",
    updatedAt: "2026-06-22T14:30:00.000Z",
  },
];

export const APPLICATION_STAGE_EVENTS: ApplicationStageEventRecord[] = [
  { id: "event-kate-applied", applicationId: "app-kate-pryor", toStage: "applied", actorUserId: "system", reason: "Application submitted", createdAt: "2026-06-22T13:30:00.000Z" },
  { id: "event-bryan-applied", applicationId: "app-bryan-lett", toStage: "applied", actorUserId: "system", reason: "Application submitted", createdAt: "2026-06-21T16:35:00.000Z" },
  { id: "event-bryan-jewelcert", applicationId: "app-bryan-lett", fromStage: "applied", toStage: "jewelcert", actorUserId: "user-hiring-manager", reason: "Sent JewelCert package", createdAt: "2026-06-22T09:00:00.000Z" },
  { id: "event-maya-applied", applicationId: "app-maya-chen", toStage: "applied", actorUserId: "system", reason: "Application submitted", createdAt: "2026-06-17T15:20:00.000Z" },
  { id: "event-maya-jewelcert", applicationId: "app-maya-chen", fromStage: "applied", toStage: "jewelcert", actorUserId: "user-hiring-manager", reason: "Sent JewelCert package", createdAt: "2026-06-18T09:00:00.000Z" },
  { id: "event-maya-gemmatch", applicationId: "app-maya-chen", fromStage: "jewelcert", toStage: "gemmatch", actorUserId: "user-hiring-manager", reason: "Invited to JewelCert", createdAt: "2026-06-19T10:15:00.000Z" },
  { id: "event-maya-interview", applicationId: "app-maya-chen", fromStage: "gemmatch", toStage: "interview", actorUserId: "user-hiring-manager", reason: "Scheduled first interview", createdAt: "2026-06-23T14:30:00.000Z" },
  { id: "event-devon-gemmatch", applicationId: "app-devon-ross", fromStage: "jewelcert", toStage: "gemmatch", actorUserId: "user-hiring-manager", reason: "Completed JewelCert with strong score", createdAt: "2026-06-22T09:30:00.000Z" },
  { id: "event-ana-rejected", applicationId: "app-ana-raper", fromStage: "gemmatch", toStage: "rejected", actorUserId: "user-hiring-manager", reason: "Team fit concern for current floor mix", createdAt: "2026-06-20T11:00:00.000Z" },
  { id: "event-jess-hired", applicationId: "app-jess-wood", fromStage: "offer", toStage: "hired", actorUserId: "user-hiring-manager", reason: "Offer accepted and synced to JewelLink", createdAt: "2026-06-22T14:30:00.000Z" },
];

export const JEWELCERT_INVITES: JewelCertInviteRecord[] = [
  {
    id: "jewelcert-bryan",
    applicationId: "app-bryan-lett",
    storeId: DEFAULT_STORE_ID,
    assessmentPackageId: "package-sales-associate-screen",
    sentByUserId: "user-hiring-manager",
    sentToEmail: "bryan.lett@email.com",
    status: "sent",
    expiresAt: "2026-06-29T09:00:00.000Z",
    sentAt: "2026-06-22T09:00:00.000Z",
  },
  {
    id: "jewelcert-maya",
    applicationId: "app-maya-chen",
    storeId: DEFAULT_STORE_ID,
    assessmentPackageId: "package-sales-associate-screen",
    sentByUserId: "user-hiring-manager",
    sentToEmail: "maya.chen@email.com",
    status: "completed",
    expiresAt: "2026-06-25T09:00:00.000Z",
    sentAt: "2026-06-18T09:00:00.000Z",
    completedAt: "2026-06-19T09:40:00.000Z",
  },
  {
    id: "jewelcert-devon",
    applicationId: "app-devon-ross",
    storeId: DEFAULT_STORE_ID,
    assessmentPackageId: "package-bench-jeweler-screen",
    sentByUserId: "user-hiring-manager",
    sentToEmail: "devon.ross@email.com",
    status: "completed",
    expiresAt: "2026-06-26T09:00:00.000Z",
    sentAt: "2026-06-20T09:00:00.000Z",
    completedAt: "2026-06-22T09:15:00.000Z",
  },
];

export const ASSESSMENT_ATTEMPT_LINKS: AssessmentAttemptLinkRecord[] = [
  {
    id: "attempt-link-maya-knowledge",
    applicationId: "app-maya-chen",
    jewelcertInviteId: "jewelcert-maya",
    assessmentAttemptId: "attempt-maya-jewelry-basic",
    assessmentType: "knowledge_check",
    scoreSummary: "68 overall; needs metal and gemstone terminology follow-up",
    completedAt: "2026-06-19T09:40:00.000Z",
  },
  {
    id: "attempt-link-maya-sales",
    applicationId: "app-maya-chen",
    jewelcertInviteId: "jewelcert-maya",
    assessmentAttemptId: "attempt-maya-sales-personality",
    assessmentType: "trait_profile",
    scoreSummary: "Strong client warmth and service consistency",
    completedAt: "2026-06-19T09:35:00.000Z",
  },
  {
    id: "attempt-link-devon-knowledge",
    applicationId: "app-devon-ross",
    jewelcertInviteId: "jewelcert-devon",
    assessmentAttemptId: "attempt-devon-jewelry-basic",
    assessmentType: "knowledge_check",
    scoreSummary: "88 overall; strong repair and materials knowledge",
    completedAt: "2026-06-22T09:15:00.000Z",
  },
];

export const GEMMATCH_INVITES: GemMatchInviteRecord[] = [
  {
    id: "gemmatch-maya",
    applicationId: "app-maya-chen",
    storeId: DEFAULT_STORE_ID,
    sentByUserId: "user-hiring-manager",
    status: "completed",
    resultProfileCode: "C",
    fitRating: "Good fit",
    completedAt: "2026-06-20T16:00:00.000Z",
    createdAt: "2026-06-19T10:15:00.000Z",
  },
  {
    id: "gemmatch-devon",
    applicationId: "app-devon-ross",
    storeId: DEFAULT_STORE_ID,
    sentByUserId: "user-hiring-manager",
    status: "completed",
    resultProfileCode: "F",
    fitRating: "Strong fit",
    completedAt: "2026-06-22T09:30:00.000Z",
    createdAt: "2026-06-22T09:20:00.000Z",
  },
  {
    id: "gemmatch-ana",
    applicationId: "app-ana-raper",
    storeId: DEFAULT_STORE_ID,
    sentByUserId: "user-hiring-manager",
    status: "completed",
    resultProfileCode: "V",
    fitRating: "Poor fit",
    completedAt: "2026-06-19T10:30:00.000Z",
    createdAt: "2026-06-18T10:00:00.000Z",
  },
];

export const INTERVIEWS: InterviewRecord[] = [
  {
    id: "interview-maya-first",
    applicationId: "app-maya-chen",
    storeId: DEFAULT_STORE_ID,
    scheduledByUserId: "user-hiring-manager",
    interviewerUserIds: ["user-hiring-manager", "user-sales-manager"],
    startsAt: "2026-06-25T19:30:00.000Z",
    endsAt: "2026-06-25T20:00:00.000Z",
    locationType: "in_store",
    locationDetails: "Little Rock showroom",
    status: "scheduled",
    createdAt: "2026-06-23T14:30:00.000Z",
    updatedAt: "2026-06-23T14:30:00.000Z",
  },
  {
    id: "interview-jess-final",
    applicationId: "app-jess-wood",
    storeId: DEFAULT_STORE_ID,
    scheduledByUserId: "user-hiring-manager",
    interviewerUserIds: ["user-hiring-manager"],
    startsAt: "2026-06-21T16:00:00.000Z",
    endsAt: "2026-06-21T17:00:00.000Z",
    locationType: "video",
    locationDetails: "JewelLink video room",
    status: "completed",
    outcome: "Strong leadership fit; moved to offer.",
    createdAt: "2026-06-20T14:00:00.000Z",
    updatedAt: "2026-06-21T17:05:00.000Z",
  },
];

export const APPLICANT_NOTES: ApplicantNoteRecord[] = [
  {
    id: "note-kate-1",
    applicationId: "app-kate-pryor",
    storeId: DEFAULT_STORE_ID,
    authorUserId: "user-hiring-manager",
    body: "Resume reads warm and service-oriented. Send JewelCert if schedule availability checks out.",
    visibility: "store_internal",
    noteType: "general",
    createdAt: "2026-06-22T14:00:00.000Z",
    updatedAt: "2026-06-22T14:00:00.000Z",
  },
  {
    id: "note-maya-1",
    applicationId: "app-maya-chen",
    storeId: DEFAULT_STORE_ID,
    authorUserId: "user-hiring-manager",
    body: "Strong luxury background. Ask about closing confidence and comfort with repair handoffs.",
    visibility: "store_internal",
    noteType: "interview",
    createdAt: "2026-06-23T14:35:00.000Z",
    updatedAt: "2026-06-23T14:35:00.000Z",
  },
  {
    id: "note-devon-1",
    applicationId: "app-devon-ross",
    storeId: DEFAULT_STORE_ID,
    authorUserId: "user-hiring-manager",
    body: "Strong JewelCert score; review CAD portfolio before bench trial.",
    visibility: "store_internal",
    noteType: "screening",
    createdAt: "2026-06-22T10:00:00.000Z",
    updatedAt: "2026-06-22T10:00:00.000Z",
  },
  {
    id: "note-jess-1",
    applicationId: "app-jess-wood",
    storeId: DEFAULT_STORE_ID,
    authorUserId: "user-hiring-manager",
    body: "Offer accepted. Sync manager profile and JewelCert summary into JewelLink.",
    visibility: "store_internal",
    noteType: "hire_handoff",
    createdAt: "2026-06-22T14:20:00.000Z",
    updatedAt: "2026-06-22T14:20:00.000Z",
  },
];

export const HIRE_TO_JEWELLINK_SYNCS: HireToJewelLinkSyncRecord[] = [
  {
    id: "sync-jess-wood",
    applicationId: "app-jess-wood",
    storeId: DEFAULT_STORE_ID,
    jewellinkTeamMemberId: "jl-team-jess-wood",
    syncedByUserId: "user-hiring-manager",
    syncStatus: "synced",
    payloadSnapshot: {
      fullName: "Jess Wood",
      role: "Sales Manager",
      gemmatchProfile: "D",
      courseCredentialIds: ["course-credential-jewellink-premium-how-to"],
    },
    createdAt: "2026-06-22T14:30:00.000Z",
    syncedAt: "2026-06-22T14:31:00.000Z",
  },
];

export function getPublishedPublicPage(slug: string) {
  return STORE_PUBLIC_PAGES.find((page) => page.slug === slug && page.status === "published");
}

export function getOpenJobsForStore(storeId: string) {
  return PUBLIC_JOBS.filter((job) => job.storeId === storeId && job.status === "open");
}

export function getApplicationsForStore(storeId: string) {
  return APPLICATIONS.filter((application) => application.storeId === storeId);
}

export function getApplicationDetail(applicationId: string): ApplicationDetail | undefined {
  const application = APPLICATIONS.find((item) => item.id === applicationId);
  if (!application) return undefined;

  return {
    application,
    profile: APPLICANT_PROFILES.find((profile) => profile.id === application.applicantProfileId)!,
    resume: APPLICANT_RESUMES.find((resume) => resume.applicantProfileId === application.applicantProfileId),
    job: PUBLIC_JOBS.find((job) => job.id === application.jobId),
    stageEvents: APPLICATION_STAGE_EVENTS.filter((event) => event.applicationId === applicationId),
    jewelcertInvites: JEWELCERT_INVITES.filter((invite) => invite.applicationId === applicationId),
    assessmentAttempts: ASSESSMENT_ATTEMPT_LINKS.filter((attempt) => attempt.applicationId === applicationId),
    gemmatchInvites: GEMMATCH_INVITES.filter((invite) => invite.applicationId === applicationId),
    interviews: INTERVIEWS.filter((interview) => interview.applicationId === applicationId),
    notes: APPLICANT_NOTES.filter((note) => note.applicationId === applicationId),
    hireSync: HIRE_TO_JEWELLINK_SYNCS.find((sync) => sync.applicationId === applicationId),
  };
}

export function searchStoreApplications(storeId: string, query: string) {
  const normalized = query.trim().toLowerCase();
  const storeApplications = getApplicationsForStore(storeId);
  if (!normalized) return storeApplications;

  return storeApplications.filter((application) => {
    const profile = APPLICANT_PROFILES.find((item) => item.id === application.applicantProfileId);
    const job = PUBLIC_JOBS.find((item) => item.id === application.jobId);
    return [profile?.fullName, profile?.email, profile?.location, job?.title]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalized));
  });
}
