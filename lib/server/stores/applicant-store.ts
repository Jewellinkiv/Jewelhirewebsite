import { ApplicationStage, getOpenJobsForStore, getPublishedPublicPage, HireSyncStatus, InterviewStatus, NoteType, PUBLIC_JOBS } from "@/lib/applicant-lifecycle";
import {
  addApplicantNote,
  completeGemMatchResponse,
  createCourseAssignments,
  createInterview,
  createJewelCertInvite,
  createPublicApplication,
  deleteApplicantNote,
  deleteCourseAssignment,
  getApplicantHome,
  getApplicantNote,
  getApplicantProfile,
  getApplicantResume,
  getApplicationDetail,
  getCourseAssignment,
  getCurrentSession,
  getHirePreview,
  getHireSyncForApplication,
  getStoreApplicantDetail,
  hireApplication,
  listApplicantApplications,
  listApplicantInterviews,
  listApplicantInvites,
  listApplicantNotes,
  listApplicantTraining,
  listApplications,
  listCourseAssignments,
  listHireSyncs,
  listStoreApplicants,
  listStoreGemMatchInvites,
  listStoreInterviews,
  listStoreJewelCertInvites,
  summarizeApplication,
  updateApplicantResume,
  updateApplicationStage,
  updateCourseAssignment,
  updateInterview,
  updateInterviewRsvp,
  updateTrainingProgress,
  createNewCandidateInterview,
} from "@/lib/local-api-store";
import { activeStoreId, requireStoreAccess } from "@/lib/server/access-control";
import { selectStoreAdapter } from "@/lib/server/storage-runtime";

type MaybePromise<T> = T | Promise<T>;

export interface ListStoreApplicationsInput {
  storeId: string;
  query?: string;
  stage?: ApplicationStage;
}

export interface ListStoreApplicantsInput {
  storeId: string;
  q?: string;
  scope?: string;
  role?: string;
}

export interface ListCourseAssignmentsInput {
  storeId?: string | null;
  recipientId?: string | null;
  status?: string | null;
  courseSlug?: string | null;
}

export interface CreateCourseAssignmentsInput {
  storeId: string;
  courseId?: string;
  courseSlug?: string;
  recipientIds: string[];
  packageName?: string;
  dueAt?: string;
  source?: Parameters<typeof createCourseAssignments>[0]["source"];
}

export interface CreatePublicApplicationInput {
  storeSlug: string;
  jobId?: string;
  profile: Record<string, unknown>;
}

export interface AddApplicantNoteInput {
  applicantId: string;
  body: string;
  noteType?: NoteType;
}

export interface CreateJewelCertInviteInput {
  storeId: string;
  applicationId: string;
  componentIds?: string[];
  courseSlugs?: string[];
}

export interface CreateInterviewInput {
  applicationId: string;
  date?: string;
  time?: string;
  startsAt?: string;
  duration?: number;
  type?: "in_store" | "phone" | "video";
  location?: string;
  interviewer?: string;
  notes?: string;
}

export interface UpdateApplicantResumeInput {
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

export interface ApplicantStore {
  getCurrentSession: typeof getCurrentSession;
  getPublishedPublicPage: typeof getPublishedPublicPage;
  getOpenJobsForStore: typeof getOpenJobsForStore;
  getPublicJob(input: { storeSlug: string; jobId: string }): ReturnType<typeof PUBLIC_JOBS.find>;
  createPublicApplication(input: CreatePublicApplicationInput): ReturnType<typeof createPublicApplication>;
  listStoreApplications(input: ListStoreApplicationsInput): MaybePromise<ReturnType<typeof listApplications>>;
  listStoreApplicationSummaries(input: ListStoreApplicationsInput): MaybePromise<{
    total: number;
    items: ReturnType<typeof summarizeApplication>[];
  }>;
  summarizeApplication: typeof summarizeApplication;
  listStoreApplicants(input: ListStoreApplicantsInput): MaybePromise<ReturnType<typeof listStoreApplicants>>;
  getStoreApplicationDetail(input: { applicationId: string; storeId: string }): MaybePromise<ReturnType<typeof getApplicationDetail>>;
  updateApplicationStage(input: { applicationId: string; toStage: ApplicationStage; reason: string }): ReturnType<typeof updateApplicationStage>;
  getStoreApplicantDetail: typeof getStoreApplicantDetail;
  listApplicantNotes: typeof listApplicantNotes;
  listScopedApplicantNotes(applicantId: string): MaybePromise<ReturnType<typeof listApplicantNotes>>;
  addApplicantNote(input: AddApplicantNoteInput): ReturnType<typeof addApplicantNote>;
  addScopedApplicantNote(input: AddApplicantNoteInput): MaybePromise<ReturnType<typeof addApplicantNote>>;
  getApplicantNote: typeof getApplicantNote;
  deleteApplicantNote(noteId: string): MaybePromise<ReturnType<typeof deleteApplicantNote>>;
  listStoreJewelCertInvites(storeId: string): MaybePromise<ReturnType<typeof listStoreJewelCertInvites>>;
  createJewelCertInvite(input: CreateJewelCertInviteInput): ReturnType<typeof createJewelCertInvite>;
  listApplicantInvites: typeof listApplicantInvites;
  listStoreGemMatchInvites(storeId: string, status?: string | null): MaybePromise<ReturnType<typeof listStoreGemMatchInvites>>;
  completeGemMatchResponse: typeof completeGemMatchResponse;
  createInterview(input: CreateInterviewInput): ReturnType<typeof createInterview>;
  createNewCandidateInterview(input: Parameters<typeof createNewCandidateInterview>[0]): ReturnType<typeof createNewCandidateInterview>;
  updateInterviewRsvp: typeof updateInterviewRsvp;
  updateInterview(input: { interviewId: string; status?: InterviewStatus; notes?: string }): ReturnType<typeof updateInterview>;
  listApplicantInterviews: typeof listApplicantInterviews;
  listStoreInterviews(input: { storeId: string; status?: InterviewStatus }): MaybePromise<ReturnType<typeof listStoreInterviews>>;
  getHirePreview: typeof getHirePreview;
  getHireSyncForApplication: typeof getHireSyncForApplication;
  hireApplication: typeof hireApplication;
  listHireSyncs(input: { storeId: string; status?: HireSyncStatus }): MaybePromise<ReturnType<typeof listHireSyncs>>;
  getApplicantResume: typeof getApplicantResume;
  updateApplicantResume(input: UpdateApplicantResumeInput): ReturnType<typeof updateApplicantResume>;
  listApplicantTraining: typeof listApplicantTraining;
  updateTrainingProgress: typeof updateTrainingProgress;
  updateScopedTrainingProgress(input: { assignmentId: string; progress: number; storeId?: string | null }): MaybePromise<ReturnType<typeof updateTrainingProgress>>;
  listCourseAssignments(input?: ListCourseAssignmentsInput): MaybePromise<ReturnType<typeof listCourseAssignments>>;
  createCourseAssignments(input: CreateCourseAssignmentsInput): MaybePromise<ReturnType<typeof createCourseAssignments>>;
  getCourseAssignment: typeof getCourseAssignment;
  getScopedCourseAssignment(input: { assignmentId: string; storeId?: string | null }): MaybePromise<ReturnType<typeof getCourseAssignment>>;
  updateCourseAssignment: typeof updateCourseAssignment;
  updateScopedCourseAssignment(input: {
    assignmentId: string;
    storeId?: string | null;
    progress?: number;
    status?: Parameters<typeof updateCourseAssignment>[1]["status"];
    dueAt?: string | null;
    packageName?: string;
  }): MaybePromise<ReturnType<typeof updateCourseAssignment>>;
  deleteCourseAssignment: typeof deleteCourseAssignment;
  deleteScopedCourseAssignment(input: { assignmentId: string; storeId?: string | null }): MaybePromise<ReturnType<typeof deleteCourseAssignment>>;
  getApplicantHome: typeof getApplicantHome;
  listApplicantApplications: typeof listApplicantApplications;
  getApplicantProfile: typeof getApplicantProfile;
}

const localApplicantStore: ApplicantStore = {
  getCurrentSession,
  getPublishedPublicPage,
  getOpenJobsForStore,
  getPublicJob(input) {
    const page = getPublishedPublicPage(input.storeSlug);
    if (!page) return undefined;
    return PUBLIC_JOBS.find(
      (item) =>
        (item.id === input.jobId || item.id === `job-${input.jobId}`) &&
        item.storeId === page.storeId &&
        item.status === "open",
    );
  },
  createPublicApplication,
  async listStoreApplications(input) {
    await requireStoreAccess(input.storeId, "applications.list");
    return listApplications(input.storeId, input.query || "", input.stage);
  },
  async listStoreApplicationSummaries(input) {
    const applications = await localApplicantStore.listStoreApplications(input);
    return {
      total: listApplications(input.storeId).length,
      items: applications.map(summarizeApplication),
    };
  },
  summarizeApplication,
  async listStoreApplicants(input) {
    await requireStoreAccess(input.storeId, "applicants.list");
    return listStoreApplicants(input);
  },
  async getStoreApplicationDetail(input) {
    await requireStoreAccess(input.storeId, "applications.detail");
    const detail = getApplicationDetail(input.applicationId);
    if (!detail || detail.application.storeId !== input.storeId) return undefined;
    return detail;
  },
  updateApplicationStage(input) {
    return updateApplicationStage(input.applicationId, input.toStage, input.reason);
  },
  getStoreApplicantDetail,
  listApplicantNotes,
  async listScopedApplicantNotes(applicantId) {
    const detail = getStoreApplicantDetail(applicantId);
    if (!detail) return [];
    await requireStoreAccess(detail.application.storeId, "applicant_notes.list");
    return listApplicantNotes(applicantId);
  },
  addApplicantNote,
  async addScopedApplicantNote(input) {
    const detail = getStoreApplicantDetail(input.applicantId);
    if (!detail) return undefined;
    await requireStoreAccess(detail.application.storeId, "applicant_notes.create");
    return addApplicantNote(input);
  },
  getApplicantNote,
  async deleteApplicantNote(noteId) {
    const note = getApplicantNote(noteId);
    if (!note) return undefined;
    await requireStoreAccess(note.storeId, "applicant_notes.delete");
    return deleteApplicantNote(noteId);
  },
  async listStoreJewelCertInvites(storeId) {
    return listStoreJewelCertInvites(await requireStoreAccess(storeId, "jewelcert_invites.list"));
  },
  createJewelCertInvite,
  listApplicantInvites,
  async listStoreGemMatchInvites(storeId, status) {
    return listStoreGemMatchInvites(await requireStoreAccess(storeId, "gemmatch_invites.list"), status);
  },
  completeGemMatchResponse,
  createInterview,
  createNewCandidateInterview,
  updateInterviewRsvp,
  updateInterview,
  listApplicantInterviews,
  async listStoreInterviews(input) {
    await requireStoreAccess(input.storeId, "interviews.list");
    return listStoreInterviews(input.storeId, input.status);
  },
  getHirePreview,
  getHireSyncForApplication,
  hireApplication,
  async listHireSyncs(input) {
    await requireStoreAccess(input.storeId, "hire_syncs.list");
    return listHireSyncs(input.storeId, input.status);
  },
  getApplicantResume,
  updateApplicantResume,
  listApplicantTraining,
  updateTrainingProgress,
  async updateScopedTrainingProgress(input) {
    const assignment = getCourseAssignment(input.assignmentId);
    if (!assignment) return undefined;
    await requireStoreAccess(input.storeId || assignment.storeId || await activeStoreId(), "course_assignments.progress");
    return updateTrainingProgress(input.assignmentId, input.progress);
  },
  async listCourseAssignments(input = {}) {
    const scopedInput = { ...input, storeId: input.storeId || await activeStoreId() };
    await requireStoreAccess(scopedInput.storeId, "course_assignments.list");
    return listCourseAssignments(scopedInput);
  },
  async createCourseAssignments(input) {
    await requireStoreAccess(input.storeId, "course_assignments.create");
    return createCourseAssignments(input);
  },
  getCourseAssignment,
  async getScopedCourseAssignment(input) {
    const assignment = getCourseAssignment(input.assignmentId);
    if (!assignment) return undefined;
    await requireStoreAccess(input.storeId || assignment.storeId || await activeStoreId(), "course_assignments.detail");
    return assignment;
  },
  updateCourseAssignment,
  async updateScopedCourseAssignment(input) {
    const assignment = getCourseAssignment(input.assignmentId);
    if (!assignment) return undefined;
    await requireStoreAccess(input.storeId || assignment.storeId || await activeStoreId(), "course_assignments.update");
    return updateCourseAssignment(input.assignmentId, {
      progress: input.progress,
      status: input.status,
      dueAt: input.dueAt,
      packageName: input.packageName,
    });
  },
  deleteCourseAssignment,
  async deleteScopedCourseAssignment(input) {
    const assignment = getCourseAssignment(input.assignmentId);
    if (!assignment) return undefined;
    await requireStoreAccess(input.storeId || assignment.storeId || await activeStoreId(), "course_assignments.delete");
    return deleteCourseAssignment(input.assignmentId);
  },
  getApplicantHome,
  listApplicantApplications,
  getApplicantProfile,
};

export function getApplicantStore(): ApplicantStore {
  return selectStoreAdapter("applicant-store", {
    local: localApplicantStore,
  });
}
