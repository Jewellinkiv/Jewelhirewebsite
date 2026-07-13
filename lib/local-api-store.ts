import {
  APPLICANT_NOTES,
  APPLICANT_PROFILES,
  APPLICANT_RESUMES,
  APPLICATION_STAGE_EVENTS,
  APPLICATIONS,
  ASSESSMENT_ATTEMPT_LINKS,
  DEFAULT_STORE_ID,
  GEMMATCH_INVITES,
  HIRE_TO_JEWELLINK_SYNCS,
  INTERVIEWS,
  JEWELCERT_INVITES,
  PUBLIC_JOBS,
  STORE_PUBLIC_PAGES,
  ApplicantNoteRecord,
  ApplicantProfileRecord,
  ApplicantResumeRecord,
  ApplicationRecord,
  ApplicationStage,
  ApplicationStageEventRecord,
  AssessmentAttemptLinkRecord,
  GemMatchInviteRecord,
  HireToJewelLinkSyncRecord,
  InterviewLocationType,
  InterviewRecord,
  InterviewStatus,
  JewelCertInviteRecord,
  NoteType,
} from "@/lib/applicant-lifecycle";
import { ASSOC_TRAINING, TrainingAssignment } from "@/lib/associate-portal";
import { Mix, PROFILE_ORDER, ProfileCode, PROFILES, TYPE_BY_PAIR } from "@/lib/gemmatch";
import { ADJECTIVES, score as scoreGemMatch } from "@/lib/server/gemmatch-scoring";
import { CERT_COMPONENTS, CERT_COURSES } from "@/lib/jewelcert";
import { listStoreAssessments } from "@/lib/local-assessment-store";
import { SESSION } from "@/lib/session";
import { COURSES, courseStats, getCourse } from "@/lib/training-center";
import { courseTitleById } from "@/lib/courses";
import { addTeamMember, getTeamComposition, listStoreTeamMembers } from "@/lib/local-team-store";

export type CourseAssignmentRecord = TrainingAssignment & {
  storeId: string;
  courseSlug: string;
  recipientId: string;
  recipientName: string;
  recipientEmail?: string;
  recipientType: "applicant" | "team_member";
  applicationId?: string;
  teamMemberId?: string;
  assignedByUserId: string;
  assignedAt: string;
  dueAt?: string;
  source: "seed" | "manager" | "jewelcert" | "hire_handoff";
  courseStats: ReturnType<typeof courseStats>;
  lastActivityAt: string;
  credentialId?: string;
};

type StoreState = {
  activeApplicantEmail: string;
  profiles: ApplicantProfileRecord[];
  resumes: ApplicantResumeRecord[];
  applications: ApplicationRecord[];
  stageEvents: ApplicationStageEventRecord[];
  jewelcertInvites: JewelCertInviteRecord[];
  assessmentAttempts: AssessmentAttemptLinkRecord[];
  gemmatchInvites: GemMatchInviteRecord[];
  interviews: InterviewRecord[];
  notes: ApplicantNoteRecord[];
  hireSyncs: HireToJewelLinkSyncRecord[];
  trainingAssignments: CourseAssignmentRecord[];
};

type GlobalWithStore = typeof globalThis & {
  __jewelhireLocalStore?: StoreState;
};

const globalStore = globalThis as GlobalWithStore;

function clone<T>(records: T[]): T[] {
  return records.map((record) => structuredClone(record));
}

function courseForSeedAssignment(assignment: TrainingAssignment) {
  if (assignment.id === "tr1") return getCourse("four-cs")!;
  if (assignment.id === "tr2") return getCourse("clienteling-follow-up")!;
  if (assignment.id === "tr3") return getCourse("first-impressions")!;
  return COURSES[0];
}

function seedTrainingAssignments(): CourseAssignmentRecord[] {
  const seededAt = "2026-06-12T14:00:00.000Z";
  return ASSOC_TRAINING.map((assignment) => {
    const course = courseForSeedAssignment(assignment);
    return {
      ...structuredClone(assignment),
      storeId: DEFAULT_STORE_ID,
      courseSlug: course.slug,
      recipientId: "profile-maya-chen",
      recipientName: "Maya Chen",
      recipientEmail: DEFAULT_APPLICANT_EMAIL,
      recipientType: "applicant",
      applicationId: "app-maya-chen",
      assignedByUserId: getCurrentSession().userId,
      assignedAt: seededAt,
      source: "seed",
      courseStats: courseStats(course),
      lastActivityAt: seededAt,
    };
  });
}

function state(): StoreState {
  if (!globalStore.__jewelhireLocalStore) {
    globalStore.__jewelhireLocalStore = {
      activeApplicantEmail: DEFAULT_APPLICANT_EMAIL,
      profiles: clone(APPLICANT_PROFILES),
      resumes: clone(APPLICANT_RESUMES),
      applications: clone(APPLICATIONS),
      stageEvents: clone(APPLICATION_STAGE_EVENTS),
      jewelcertInvites: clone(JEWELCERT_INVITES),
      assessmentAttempts: clone(ASSESSMENT_ATTEMPT_LINKS),
      gemmatchInvites: clone(GEMMATCH_INVITES),
      interviews: clone(INTERVIEWS),
      notes: clone(APPLICANT_NOTES),
      hireSyncs: clone(HIRE_TO_JEWELLINK_SYNCS),
      trainingAssignments: seedTrainingAssignments(),
    };
  }

  return globalStore.__jewelhireLocalStore;
}

const DEFAULT_APPLICANT_EMAIL = "maya.chen@email.com";

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

function publicApplicantId(name: string) {
  return slugify(name);
}

function id(prefix: string, seed: string) {
  return `${prefix}-${slugify(seed) || "record"}-${Date.now().toString(36)}`;
}

export function getCurrentSession() {
  return {
    userId: "user-hiring-manager",
    name: SESSION.name,
    email: SESSION.email,
    role: "store_owner" as const,
    storeIds: [DEFAULT_STORE_ID],
    storeRoles: { [DEFAULT_STORE_ID]: "store_owner" as const },
    locationScopes: { [DEFAULT_STORE_ID]: { allLocations: true, locationIds: [] } },
    activeStoreId: DEFAULT_STORE_ID,
    guardrails: {
      phase: "phase_1_single_store" as const,
      applicantScope: "store_private" as const,
      marketplace: false as const,
      candidateReviews: false as const,
    },
  };
}

function applicantEmail(email?: string | null) {
  return email?.trim().toLowerCase() || state().activeApplicantEmail;
}

export function getPublicStore(slug: string) {
  return STORE_PUBLIC_PAGES.find((page) => page.slug === slug && page.status === "published");
}

function matchesPublicJobId(jobId: string, inputJobId: string) {
  return jobId === inputJobId || jobId === `job-${inputJobId}`;
}

export function getOpenJobs(storeId: string) {
  return PUBLIC_JOBS.filter((job) => job.storeId === storeId && job.status === "open");
}

export function getApplicationDetail(applicationId: string) {
  const store = state();
  const application = store.applications.find((item) => item.id === applicationId);
  if (!application) return undefined;

  return {
    application,
    profile: store.profiles.find((profile) => profile.id === application.applicantProfileId),
    resume: store.resumes.find((resume) => resume.applicantProfileId === application.applicantProfileId),
    job: PUBLIC_JOBS.find((job) => job.id === application.jobId),
    stageEvents: store.stageEvents.filter((event) => event.applicationId === applicationId),
    jewelcertInvites: store.jewelcertInvites.filter((invite) => invite.applicationId === applicationId),
    assessmentAttempts: store.assessmentAttempts.filter((attempt) => attempt.applicationId === applicationId),
    gemmatchInvites: store.gemmatchInvites.filter((invite) => invite.applicationId === applicationId),
    interviews: store.interviews.filter((interview) => interview.applicationId === applicationId),
    notes: store.notes.filter((note) => note.applicationId === applicationId),
    hireSync: store.hireSyncs.find((sync) => sync.applicationId === applicationId),
  };
}

function findProfileByIdentifier(identifier: string) {
  const normalized = identifier.toLowerCase();
  return state().profiles.find(
    (profile) =>
      profile.id === identifier ||
      profile.email.toLowerCase() === normalized ||
      publicApplicantId(profile.fullName) === normalized,
  );
}

function findApplicationByApplicantIdentifier(identifier: string) {
  const store = state();
  const direct = store.applications.find((application) => application.id === identifier);
  if (direct) return direct;
  const profile = findProfileByIdentifier(identifier);
  if (!profile) return undefined;
  return store.applications.find((application) => application.applicantProfileId === profile.id);
}

export function listApplications(storeId: string, query = "", stage?: ApplicationStage) {
  const store = state();
  const normalized = query.trim().toLowerCase();

  return store.applications
    .filter((application) => application.storeId === storeId)
    .filter((application) => !stage || application.stage === stage)
    .filter((application) => {
      if (!normalized) return true;
      const profile = store.profiles.find((item) => item.id === application.applicantProfileId);
      const job = PUBLIC_JOBS.find((item) => item.id === application.jobId);
      return [profile?.fullName, profile?.email, profile?.location, job?.title]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized));
    });
}

export function summarizeApplication(application: ApplicationRecord) {
  const store = state();
  const profile = store.profiles.find((item) => item.id === application.applicantProfileId);
  const job = PUBLIC_JOBS.find((item) => item.id === application.jobId);
  const jewelcert = store.jewelcertInvites.find((invite) => invite.applicationId === application.id);
  const gemmatch = store.gemmatchInvites.find((invite) => invite.applicationId === application.id);
  const nextInterview = store.interviews.find(
    (interview) => interview.applicationId === application.id && interview.status === "scheduled",
  );
  const noteCount = store.notes.filter((note) => note.applicationId === application.id).length;

  return {
    application,
    applicant: profile,
    store: inviteStore(application.storeId),
    job,
    screening: {
      jewelcertStatus: jewelcert?.status || "not_sent",
      gemmatchStatus: gemmatch?.status || "not_sent",
      gemmatchProfile: gemmatch?.resultProfileCode,
      gemmatchFit: gemmatch?.fitRating,
    },
    nextInterview,
    noteCount,
  };
}

function statusFromStage(stage: ApplicationStage) {
  if (stage === "hired") return "Hired";
  if (stage === "rejected") return "Rejected";
  if (stage === "withdrawn") return "Withdrawn";
  return "Active";
}

function applicantInitials(name: string) {
  return name.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase() || "NA";
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

export function listStoreApplicants(input: { storeId: string; q?: string; scope?: string; role?: string }) {
  const query = input.q?.trim().toLowerCase() || "";
  const rows = listApplications(input.storeId)
    .map((application) => {
      const profile = state().profiles.find((item) => item.id === application.applicantProfileId);
      const job = PUBLIC_JOBS.find((item) => item.id === application.jobId);
      if (!profile) return undefined;
      const status = statusFromStage(application.stage);
      const notes = state().notes.filter((note) => note.applicationId === application.id);
      return {
        id: publicApplicantId(profile.fullName),
        profileId: profile.id,
        applicationId: application.id,
        linkable: true,
        name: profile.fullName,
        initials: applicantInitials(profile.fullName),
        role: job?.title || profile.resumeHeadline || "Jewelry role",
        status,
        stage: application.stage,
        appliedDate: application.submittedAt,
        lastActivity: application.lastActivityAt,
        email: profile.email,
        location: profile.location,
        notesCount: notes.length,
        notes,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((row) => {
      if (input.scope === "Active" && row.status !== "Active") return false;
      if (input.scope === "Past" && row.status === "Active") return false;
      if (input.role && input.role !== "All" && row.role !== input.role) return false;
      if (!query) return true;
      return [row.name, row.role, row.email, row.location].some((value) => value.toLowerCase().includes(query));
    });

  return rows;
}

export function getStoreApplicantDetail(identifier: string) {
  const application = findApplicationByApplicantIdentifier(identifier);
  if (!application) return undefined;
  const detail = getApplicationDetail(application.id);
  if (!detail?.profile) return undefined;
  const profile = detail.profile;
  const allApplications = state().applications.filter(
    (item) => item.applicantProfileId === profile.id,
  );
  const latestGemMatch = detail.gemmatchInvites.find((invite) => invite.status === "completed") || detail.gemmatchInvites.at(0);

  return {
    id: publicApplicantId(profile.fullName),
    profileId: profile.id,
    applicationId: application.id,
    profile,
    resume: detail.resume,
    application,
    job: detail.job,
    status: statusFromStage(application.stage),
    applications: allApplications.map((item) => ({
      id: item.id,
      role: PUBLIC_JOBS.find((job) => job.id === item.jobId)?.title || "Jewelry role",
      appliedDate: item.submittedAt,
      outcome: item.stage === "hired" ? "Hired" : item.stage === "rejected" ? "Rejected" : item.stage === "withdrawn" ? "Withdrawn" : "In progress",
      note: item.statusReason,
    })),
    gemmatch: latestGemMatch
      ? {
          type:
            latestGemMatch.resultProfileCode === "C"
              ? "Luxury Advisor"
              : latestGemMatch.resultProfileCode === "F"
                ? "Master Craftsman"
                : latestGemMatch.resultProfileCode === "D"
                  ? "Sales Strategist"
                  : "Trailblazer",
          primary: latestGemMatch.resultProfileCode || "C",
          mix: { V: 20, C: latestGemMatch.resultProfileCode === "C" ? 55 : 20, F: latestGemMatch.resultProfileCode === "F" ? 55 : 20, D: latestGemMatch.resultProfileCode === "D" ? 40 : 20 },
          fitScore: latestGemMatch.fitRating === "Strong fit" ? 88 : latestGemMatch.fitRating === "Poor fit" ? 32 : 74,
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

export function getApplicantProfile(email?: string | null) {
  const normalized = applicantEmail(email);
  return state().profiles.find((profile) => profile.email.toLowerCase() === normalized);
}

export function listApplicantApplications(email?: string | null) {
  const profile = getApplicantProfile(email);
  if (!profile) return [];
  return state()
    .applications.filter((application) => application.applicantProfileId === profile.id)
    .map(summarizeApplication);
}

export function getApplicantHome(email?: string | null) {
  const applications = listApplicantApplications(email);
  const active = applications.filter((item) =>
    ["applied", "jewelcert", "gemmatch", "interview", "offer"].includes(item.application.stage),
  );
  const nextApplication = active.at(0);
  const interviews = listApplicantInterviews(email).filter((interview) => interview.status === "scheduled");
  const invites = listApplicantInvites(email).filter((invite) => invite.status !== "completed");

  return {
    applicant: getApplicantProfile(email),
    counts: {
      activeApplications: active.length,
      completedInvites: listApplicantInvites(email).filter((invite) => invite.status === "completed").length,
      pendingInvites: invites.length,
      upcomingInterviews: interviews.length,
    },
    nextStep: nextApplication
      ? {
          applicationId: nextApplication.application.id,
          stage: nextApplication.application.stage,
          role: nextApplication.job?.title,
          storeId: nextApplication.application.storeId,
        }
      : null,
    upcomingInterview: interviews.at(0) || null,
    pendingInvite: invites.at(0) || null,
  };
}

// Resolve an invite's storeId to its display name so the applicant-facing
// invite shape carries a store the same way postgres does (see
// listPostgresApplicantInvites). Local seeding only holds the default store.
function inviteStore(storeId: string) {
  const name = storeId === DEFAULT_STORE_ID ? "Sissy's Log Cabin" : "the store";
  return { id: storeId, name, location: undefined as string | undefined };
}

export function listApplicantInvites(email?: string | null) {
  const profile = getApplicantProfile(email);
  if (!profile) return [];
  const applicationIds = state()
    .applications.filter((application) => application.applicantProfileId === profile.id)
    .map((application) => application.id);

  return [
    ...state()
      .jewelcertInvites.filter((invite) => applicationIds.includes(invite.applicationId))
      .map((invite) => ({
        ...invite,
        kind: "JewelCert" as const,
        sortAt: invite.sentAt || invite.completedAt || "",
        application: state().applications.find((application) => application.id === invite.applicationId),
        job: PUBLIC_JOBS.find(
          (job) => job.id === state().applications.find((application) => application.id === invite.applicationId)?.jobId,
        ),
        store: inviteStore(invite.storeId),
      })),
    ...state()
      .gemmatchInvites.filter((invite) => applicationIds.includes(invite.applicationId))
      .map((invite) => ({
        ...invite,
        kind: "GemMatch" as const,
        sortAt: invite.createdAt || invite.completedAt || "",
        application: state().applications.find((application) => application.id === invite.applicationId),
        job: PUBLIC_JOBS.find(
          (job) => job.id === state().applications.find((application) => application.id === invite.applicationId)?.jobId,
        ),
        store: inviteStore(invite.storeId),
      })),
  ].sort((a, b) => b.sortAt.localeCompare(a.sortAt));
}

export function listApplicantInterviews(email?: string | null) {
  const profile = getApplicantProfile(email);
  if (!profile) return [];
  const applicationIds = state()
    .applications.filter((application) => application.applicantProfileId === profile.id)
    .map((application) => application.id);
  return state()
    .interviews.filter((interview) => applicationIds.includes(interview.applicationId))
    .map((interview) => ({
      ...interview,
      store: inviteStore(interview.storeId),
      application: state().applications.find((application) => application.id === interview.applicationId),
      job: PUBLIC_JOBS.find(
        (job) => job.id === state().applications.find((application) => application.id === interview.applicationId)?.jobId,
      ),
    }));
}

export function listStoreInterviews(storeId: string, status?: InterviewStatus | null) {
  return state()
    .interviews.filter((interview) => interview.storeId === storeId)
    .filter((interview) => !status || interview.status === status)
    .map((interview) => {
      const detail = getApplicationDetail(interview.applicationId);
      return {
        interview,
        applicant: detail?.profile
          ? {
              id: publicApplicantId(detail.profile.fullName),
              name: detail.profile.fullName,
              initials: applicantInitials(detail.profile.fullName),
              role: detail.job?.title || detail.profile.resumeHeadline,
              email: detail.profile.email,
            }
          : null,
        job: detail?.job,
      };
    })
    .sort((a, b) => a.interview.startsAt.localeCompare(b.interview.startsAt));
}

export function getApplicantResume(email?: string | null) {
  const profile = getApplicantProfile(email);
  if (!profile) return undefined;
  const resume = state().resumes.find((item) => item.applicantProfileId === profile.id);
  return { profile, resume };
}

export function updateApplicantResume(input: {
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
}) {
  const profile = getApplicantProfile(input.lookupEmail || input.email);
  if (!profile) return undefined;
  const store = state();
  let resume = store.resumes.find((item) => item.applicantProfileId === profile.id);
  if (!resume) {
    resume = {
      id: id("resume", profile.fullName),
      applicantProfileId: profile.id,
      summary: "",
      workExperience: [],
      education: [],
      skills: [],
      portfolioLinks: [],
      courseCredentialIds: [],
      updatedAt: nowIso(),
    };
    store.resumes.unshift(resume);
  }

  profile.fullName = input.fullName ?? profile.fullName;
  profile.email = input.email ?? profile.email;
  profile.phone = input.phone ?? profile.phone;
  profile.resumeHeadline = input.headline ?? profile.resumeHeadline;
  profile.location = input.location ?? profile.location;
  profile.updatedAt = nowIso();
  store.activeApplicantEmail = profile.email.toLowerCase();
  resume.summary = input.summary ?? resume.summary;
  resume.workExperience = input.workExperience ?? resume.workExperience;
  resume.education = input.education ?? resume.education;
  resume.skills = input.skills ?? resume.skills;
  resume.portfolioLinks = input.portfolioLinks ?? resume.portfolioLinks;
  resume.updatedAt = nowIso();
  return { profile, resume, templateId: input.templateId };
}

function resolveTrainingCourse(courseId?: string | null) {
  if (!courseId) return undefined;
  const normalized = courseId.trim().toLowerCase();
  return COURSES.find((course) => course.slug === normalized || course.title.toLowerCase() === normalized);
}

function resolveTrainingRecipient(storeId: string, recipientId: string) {
  const application = findApplicationByApplicantIdentifier(recipientId);
  if (application?.storeId === storeId) {
    const profile = state().profiles.find((item) => item.id === application.applicantProfileId);
    if (profile) {
      return {
        recipientId: profile.id,
        recipientName: profile.fullName,
        recipientEmail: profile.email,
        recipientType: "applicant" as const,
        applicationId: application.id,
      };
    }
  }

  const profile = findProfileByIdentifier(recipientId);
  if (profile) {
    const profileApplication = state().applications.find(
      (item) => item.storeId === storeId && item.applicantProfileId === profile.id,
    );
    return {
      recipientId: profile.id,
      recipientName: profile.fullName,
      recipientEmail: profile.email,
      recipientType: "applicant" as const,
      applicationId: profileApplication?.id,
    };
  }

  const teamMember = listStoreTeamMembers(storeId).find(
    (member) => member.id === recipientId || member.name.toLowerCase() === recipientId.toLowerCase(),
  );
  if (teamMember) {
    return {
      recipientId: teamMember.id,
      recipientName: teamMember.name,
      recipientType: "team_member" as const,
      teamMemberId: teamMember.id,
    };
  }

  return undefined;
}

function assignmentMatchesRecipient(assignment: CourseAssignmentRecord, recipientId?: string | null) {
  if (!recipientId) return true;
  const normalized = recipientId.trim().toLowerCase();
  return [
    assignment.id,
    assignment.recipientId,
    assignment.recipientEmail,
    assignment.recipientName,
    assignment.applicationId,
    assignment.teamMemberId,
  ]
    .filter(Boolean)
    .some((value) => value!.toLowerCase() === normalized || slugify(value!) === normalized);
}

export function listApplicantTraining(email?: string | null) {
  const profile = getApplicantProfile(email);
  if (!profile) return [];
  return state().trainingAssignments.filter(
    (assignment) =>
      assignment.recipientType === "applicant" &&
      (assignment.recipientId === profile.id || assignment.recipientEmail?.toLowerCase() === profile.email.toLowerCase()),
  );
}

export function listCourseAssignments(input: {
  storeId?: string | null;
  recipientId?: string | null;
  status?: string | null;
  courseSlug?: string | null;
} = {}) {
  return state()
    .trainingAssignments.filter((assignment) => !input.storeId || assignment.storeId === input.storeId)
    .filter((assignment) => assignmentMatchesRecipient(assignment, input.recipientId))
    .filter((assignment) => !input.status || assignment.status === input.status)
    .filter((assignment) => !input.courseSlug || assignment.courseSlug === input.courseSlug);
}

export function getCourseAssignment(assignmentId: string) {
  return state().trainingAssignments.find((assignment) => assignment.id === assignmentId);
}

export function createCourseAssignments(input: {
  storeId: string;
  courseId?: string;
  courseSlug?: string;
  recipientIds: string[];
  packageName?: string;
  dueAt?: string;
  source?: CourseAssignmentRecord["source"];
}) {
  const course = resolveTrainingCourse(input.courseSlug || input.courseId);
  if (!course) return { assignments: [], skipped: input.recipientIds, error: "Course not found" };

  const timestamp = nowIso();
  const assignments: CourseAssignmentRecord[] = [];
  const skipped: string[] = [];

  for (const recipientId of input.recipientIds) {
    const recipient = resolveTrainingRecipient(input.storeId, recipientId);
    if (!recipient) {
      skipped.push(recipientId);
      continue;
    }

    const existing = state().trainingAssignments.find(
      (assignment) =>
        assignment.storeId === input.storeId &&
        assignment.courseSlug === course.slug &&
        assignment.recipientId === recipient.recipientId &&
        assignment.status !== "Completed",
    );
    if (existing) {
      if (input.dueAt) existing.dueAt = input.dueAt;
      existing.lastActivityAt = timestamp;
      assignments.push(existing);
      continue;
    }

    const assignment: CourseAssignmentRecord = {
      id: id("course-assignment", `${course.slug}-${recipient.recipientId}`),
      course: course.title,
      package: input.packageName?.trim() || "Manager-assigned training",
      assignedBy: "Sissy's Log Cabin",
      progress: 0,
      status: "Not started",
      lessons: courseStats(course).total,
      credentialed: false,
      storeId: input.storeId,
      courseSlug: course.slug,
      ...recipient,
      assignedByUserId: getCurrentSession().userId,
      assignedAt: timestamp,
      dueAt: input.dueAt,
      source: input.source || "manager",
      courseStats: courseStats(course),
      lastActivityAt: timestamp,
    };
    state().trainingAssignments.unshift(assignment);
    assignments.push(assignment);

    if (assignment.applicationId) {
      state().notes.unshift({
        id: id("note", assignment.applicationId),
        applicationId: assignment.applicationId,
        storeId: input.storeId,
        authorUserId: getCurrentSession().userId,
        body: `Assigned training: ${course.title}`,
        visibility: "store_internal",
        noteType: "general",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  }

  return { assignments, skipped };
}

export function updateCourseAssignment(
  assignmentId: string,
  input: { progress?: number; status?: TrainingAssignment["status"]; dueAt?: string | null; packageName?: string },
) {
  const assignment = getCourseAssignment(assignmentId);
  if (!assignment) return undefined;

  if (input.progress !== undefined) {
    updateTrainingProgress(assignmentId, input.progress);
  }
  if (input.status) {
    assignment.status = input.status;
    if (input.status === "Completed") {
      assignment.progress = 100;
      assignment.credentialed = true;
      assignment.credentialId = assignment.credentialId || assignment.id;
    }
  }
  if (input.dueAt !== undefined) assignment.dueAt = input.dueAt || undefined;
  if (input.packageName !== undefined) assignment.package = input.packageName.trim() || assignment.package;
  assignment.lastActivityAt = nowIso();
  if (assignment.applicationId) {
    reconcileJewelCertCompletionForApplication(assignment.applicationId);
  }
  return assignment;
}

export function deleteCourseAssignment(assignmentId: string) {
  const store = state();
  const assignment = store.trainingAssignments.find((item) => item.id === assignmentId);
  if (!assignment) return undefined;
  store.trainingAssignments = store.trainingAssignments.filter((item) => item.id !== assignmentId);
  return assignment;
}

export function updateTrainingProgress(assignmentId: string, progress: number) {
  const assignment = state().trainingAssignments.find((item) => item.id === assignmentId);
  if (!assignment) return undefined;

  const bounded = Math.max(0, Math.min(100, Math.round(progress)));
  assignment.progress = bounded;
  assignment.status = bounded >= 100 ? "Completed" : bounded > 0 ? "In progress" : "Not started";
  assignment.credentialed = bounded >= 100;
  assignment.lastActivityAt = nowIso();

  if (bounded >= 100) {
    const resume = getApplicantResume(assignment.recipientEmail)?.resume;
    if (resume && !resume.courseCredentialIds.includes(assignment.id)) {
      resume.courseCredentialIds.push(assignment.id);
      resume.updatedAt = nowIso();
    }
    assignment.credentialId = assignment.credentialId || assignment.id;
  }

  if (assignment.applicationId) {
    reconcileJewelCertCompletionForApplication(assignment.applicationId);
  }

  return assignment;
}

export function completeGemMatchResponse(input: { inviteId: string; pickedAdjectiveIds?: string[] }) {
  const store = state();
  const timestamp = nowIso();
  let invite = store.gemmatchInvites.find((item) => item.id === input.inviteId);
  const jewelcert = store.jewelcertInvites.find((item) => item.id === input.inviteId);

  if (!invite && jewelcert) {
    invite = {
      id: id("gemmatch", jewelcert.applicationId),
      applicationId: jewelcert.applicationId,
      storeId: jewelcert.storeId,
      sentByUserId: jewelcert.sentByUserId,
      status: "started",
      createdAt: timestamp,
    };
    store.gemmatchInvites.unshift(invite);
  }
  if (!invite) return undefined;

  // Resolve the submitted picks (slugified IDs or raw adjective texts) back to
  // canonical adjective texts, then score them so `primary` reflects the actual
  // trait signal. Mirrors the postgres runtime (completePostgresGemMatchResponse).
  // Falls back to Foundation when no picks resolve (empty/legacy submissions).
  const pickedTexts = (input.pickedAdjectiveIds || [])
    .map((rawId) => {
      const normalized = slugify(String(rawId));
      return ADJECTIVES.find((adj) => slugify(adj.text) === normalized || adj.text === rawId)?.text;
    })
    .filter((text): text is string => Boolean(text));
  const primary: ProfileCode = pickedTexts.length ? scoreGemMatch(pickedTexts).primary : "F";
  // Pre-update completion state so the caller only fires the "assessment
  // completed" emails on the genuine started->completed transition; a repeat
  // POST for an already-completed invite must not re-notify (mirrors postgres).
  const wasAlreadyCompleted = invite.status === "completed";
  invite.status = "completed";
  invite.resultProfileCode = primary;
  invite.fitRating = primary === "C" || primary === "F" ? "Strong fit" : "Good fit";
  invite.completedAt = timestamp;

  // Completing the pick-10 profile is not the same as completing the whole JewelCert
  // package. JewelCert should only move to completed when its required
  // assessment attempts are actually present.
  updateApplicationStage(invite.applicationId, "gemmatch", "Completed JewelCert response");
  reconcileJewelCertCompletionForApplication(invite.applicationId);
  return { invite, result: { primary, fitRating: invite.fitRating }, wasAlreadyCompleted };
}

export function createPublicApplication(input: {
  storeSlug: string;
  jobId: string;
  profile: {
    name: string;
    email: string;
    phone?: string;
    location?: string;
    headline?: string;
    summary?: string;
    skills?: string[] | string;
    experience?: string[] | string;
    education?: string[] | string;
  };
}) {
  const publicPage = getPublicStore(input.storeSlug);
  if (!publicPage) return { error: "Public store page not found" as const };

  const job = PUBLIC_JOBS.find(
    (item) => matchesPublicJobId(item.id, input.jobId) && item.storeId === publicPage.storeId && item.status === "open",
  );
  if (!job) return { error: "Public job not found" as const };

  const name = input.profile.name?.trim();
  const email = input.profile.email?.trim().toLowerCase();
  if (!name || !email || !email.includes("@")) {
    return { error: "Applicant name and valid email are required" as const };
  }

  const store = state();
  const timestamp = nowIso();
  const profileId = id("profile", name);
  const applicationId = id("app", `${name}-${job.id}`);
  const resumeId = id("resume", name);

  const toList = (value: string[] | string | undefined) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (!value) return [];
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const profile: ApplicantProfileRecord = {
    id: profileId,
    fullName: name,
    email,
    phone: input.profile.phone || "",
    location: input.profile.location || "",
    resumeHeadline: input.profile.headline || job.title,
    summary: input.profile.summary || "",
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
    storeId: publicPage.storeId,
    jobId: job.id,
    applicantProfileId: profileId,
    source: "public_store_page",
    stage: "applied",
    submittedAt: timestamp,
    lastActivityAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.profiles.unshift(profile);
  store.resumes.unshift(resume);
  store.applications.unshift(application);
  store.activeApplicantEmail = email;
  store.stageEvents.unshift({
    id: id("event", `${applicationId}-applied`),
    applicationId,
    toStage: "applied",
    actorUserId: "system",
    reason: "Application submitted from public store page",
    createdAt: timestamp,
  });

  return { applicationId, application, profile, resume, job };
}

export function updateApplicationStage(applicationId: string, toStage: ApplicationStage, reason: string) {
  const store = state();
  const application = store.applications.find((item) => item.id === applicationId);
  if (!application) return undefined;

  const timestamp = nowIso();
  const fromStage = application.stage;
  application.stage = toStage;
  application.statusReason = reason;
  application.lastActivityAt = timestamp;
  application.updatedAt = timestamp;
  store.stageEvents.unshift({
    id: id("event", `${applicationId}-${toStage}`),
    applicationId,
    fromStage,
    toStage,
    actorUserId: getCurrentSession().userId,
    reason,
    createdAt: timestamp,
  });

  return getApplicationDetail(applicationId);
}

export function addApplicantNote(input: { applicantId: string; body: string; noteType?: NoteType }) {
  const store = state();
  const application = findApplicationByApplicantIdentifier(input.applicantId);
  if (!application) return undefined;

  const timestamp = nowIso();
  const note: ApplicantNoteRecord = {
    id: id("note", application.id),
    applicationId: application.id,
    storeId: application.storeId,
    authorUserId: getCurrentSession().userId,
    body: input.body.trim(),
    visibility: "store_internal",
    noteType: input.noteType || "general",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.notes.unshift(note);
  application.lastActivityAt = timestamp;
  application.updatedAt = timestamp;
  return note;
}

export function listApplicantNotes(applicantId: string) {
  const application = findApplicationByApplicantIdentifier(applicantId);
  if (!application) return [];
  return state().notes.filter((note) => note.applicationId === application.id);
}

export function getApplicantNote(noteId: string) {
  return state().notes.find((note) => note.id === noteId);
}

export function deleteApplicantNote(noteId: string) {
  const store = state();
  const note = getApplicantNote(noteId);
  if (!note) return undefined;
  store.notes = store.notes.filter((item) => item.id !== noteId);
  const application = store.applications.find((item) => item.id === note.applicationId);
  if (application) {
    application.lastActivityAt = nowIso();
    application.updatedAt = nowIso();
  }
  return note;
}

export function createJewelCertInvite(input: {
  storeId: string;
  applicationId: string;
  componentIds?: string[];
  courseSlugs?: string[];
}) {
  const detail = getApplicationDetail(input.applicationId);
  if (!detail?.application || detail.application.storeId !== input.storeId || !detail.profile) return undefined;

  const timestamp = nowIso();
  const componentIds = input.componentIds?.length ? input.componentIds : [];
  const courseSlugs = input.courseSlugs?.length ? input.courseSlugs : [];
  const packageParts = [...componentIds, ...courseSlugs.map((slug) => `course:${slug}`)];
  const invite: JewelCertInviteRecord = {
    id: id("jewelcert", input.applicationId),
    applicationId: input.applicationId,
    storeId: input.storeId,
    assessmentPackageId: packageParts.join("+") || "package-custom-jewelcert",
    sentByUserId: getCurrentSession().userId,
    sentToEmail: detail.profile.email,
    status: "sent",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    sentAt: timestamp,
  };
  state().jewelcertInvites.unshift(invite);
  if (componentIds.includes("gemmatch")) {
    state().gemmatchInvites.unshift({
      id: id("gemmatch", input.applicationId),
      applicationId: input.applicationId,
      storeId: input.storeId,
      sentByUserId: getCurrentSession().userId,
      status: "sent",
      createdAt: timestamp,
    });
  }
  updateApplicationStage(input.applicationId, "jewelcert", "Sent JewelCert package");
  reconcileJewelCertCompletionForApplication(input.applicationId);
  return invite;
}

function inviteStatusLabel(status: JewelCertInviteRecord["status"]) {
  if (status === "completed") return "Completed";
  if (status === "started") return "Started";
  if (status === "expired") return "Expired";
  if (status === "cancelled") return "Expired";
  return "Sent";
}

function packageLabels(storeId: string, assessmentPackageId: string) {
  const ids = assessmentPackageId.split("+").filter(Boolean);
  const customAssessments = new Map(
    listStoreAssessments(storeId).map((assessment) => [`assessment:${assessment.id}`, assessment.title]),
  );
  const componentLabels = ids
    .filter((item) => !item.startsWith("course:") && !item.startsWith("package-"))
    .map((item) => CERT_COMPONENTS.find((component) => component.id === item)?.label || customAssessments.get(item) || item.replace(/^assessment:/, ""));
  const courseLabels = ids
    .filter((item) => item.startsWith("course:"))
    .map((item) => {
      const slug = item.replace(/^course:/, "");
      // Resolve legacy CERT_COURSES first, then fall back to a builder-course title.
      return CERT_COURSES.find((course) => course.slug === slug)?.title || courseTitleById(slug) || slug;
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

function resolveJewelCertRequirements(assessmentPackageId: string) {
  const known = PACKAGE_REQUIREMENTS[assessmentPackageId];
  if (known) {
    return {
      componentIds: [...known.componentIds],
      courseSlugs: [...known.courseSlugs],
    };
  }

  const parts = assessmentPackageId.split("+").map((part) => part.trim()).filter(Boolean);
  return {
    componentIds: uniqueStrings(parts.filter((part) => !part.startsWith("course:") && !part.startsWith("package-"))),
    courseSlugs: uniqueStrings(parts.filter((part) => part.startsWith("course:")).map((part) => part.replace(/^course:/, ""))),
  };
}

function requiredAssessmentType(componentId: string): AssessmentAttemptLinkRecord["assessmentType"] | undefined {
  if (componentId === "sales-personality" || componentId === "12-essentials") return "trait_profile";
  if (componentId === "jewelry-knowledge" || componentId === "jewelry-basic-knowledge") return "knowledge_check";
  return undefined;
}

function reconcileJewelCertCompletionForApplication(applicationId: string) {
  const store = state();
  const timestamp = nowIso();
  for (const invite of store.jewelcertInvites.filter(
    (item) => item.applicationId === applicationId && !["completed", "expired", "cancelled"].includes(item.status),
  )) {
    const requirements = resolveJewelCertRequirements(invite.assessmentPackageId);
    if (!requirements.componentIds.length && !requirements.courseSlugs.length) continue;

    const gemmatchReady =
      !requirements.componentIds.includes("gemmatch") ||
      store.gemmatchInvites.some(
        (item) => item.applicationId === applicationId && item.storeId === invite.storeId && item.status === "completed" && item.completedAt,
      );
    if (!gemmatchReady) continue;

    const assessmentsReady = requirements.componentIds
      .filter((componentId) => componentId !== "gemmatch")
      .every((componentId) => {
        const type = requiredAssessmentType(componentId);
        return Boolean(type) && store.assessmentAttempts.some(
          (attempt) =>
            attempt.applicationId === applicationId &&
            attempt.assessmentType === type &&
            attempt.completedAt,
        );
      });
    if (!assessmentsReady) continue;

    const coursesReady = requirements.courseSlugs.every((courseSlug) =>
      store.trainingAssignments.some(
        (assignment) =>
          assignment.applicationId === applicationId &&
          assignment.storeId === invite.storeId &&
          assignment.recipientType === "applicant" &&
          assignment.courseSlug === courseSlug &&
          Boolean(assignment.credentialId || assignment.credentialed),
      ),
    );
    if (!coursesReady) continue;

    invite.status = "completed";
    invite.completedAt = invite.completedAt || timestamp;
  }
}

function gemmatchType(primary?: ProfileCode) {
  if (primary === "C") return "Luxury Advisor";
  if (primary === "F") return "Master Craftsman";
  if (primary === "D") return "Sales Strategist";
  if (primary === "V") return "Trailblazer";
  return undefined;
}

function fitScore(fit?: string) {
  if (fit === "Strong fit") return 88;
  if (fit === "Poor fit") return 32;
  if (fit === "Good fit") return 74;
  return undefined;
}

function shortDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function listStoreJewelCertInvites(storeId: string) {
  return state()
    .jewelcertInvites.filter((invite) => invite.storeId === storeId)
    .map((invite) => {
      const detail = getApplicationDetail(invite.applicationId);
      const labels = packageLabels(storeId, invite.assessmentPackageId);
      return {
        invite,
        candidate: detail?.profile
          ? {
              id: publicApplicantId(detail.profile.fullName),
              name: detail.profile.fullName,
              initials: applicantInitials(detail.profile.fullName),
              role: detail.job?.title || detail.profile.resumeHeadline,
              email: detail.profile.email,
            }
          : null,
        package: labels.title,
        contents: labels.contents,
        status: inviteStatusLabel(invite.status),
        sent: shortDate(invite.sentAt),
        due: shortDate(invite.expiresAt),
      };
    })
    .sort((a, b) => (b.invite.sentAt || "").localeCompare(a.invite.sentAt || ""));
}

export function listStoreGemMatchInvites(storeId: string, status?: string | null) {
  const normalizedStatus = status?.toLowerCase();
  return state()
    .gemmatchInvites.filter((invite) => invite.storeId === storeId)
    .filter((invite) => !normalizedStatus || invite.status === normalizedStatus)
    .map((invite) => {
      const detail = getApplicationDetail(invite.applicationId);
      return {
        invite,
        applicant: detail?.profile
          ? {
              id: publicApplicantId(detail.profile.fullName),
              name: detail.profile.fullName,
              initials: applicantInitials(detail.profile.fullName),
              role: detail.job?.title || detail.profile.resumeHeadline,
              email: detail.profile.email,
            }
          : null,
        sentDate: shortDate(invite.createdAt),
        status: invite.status === "completed" ? "Completed" : invite.status === "started" ? "Started" : "Sent",
        type: gemmatchType(invite.resultProfileCode),
        primary: invite.resultProfileCode,
        fitScore: fitScore(invite.fitRating),
        fitTier: invite.fitRating,
      };
    })
    .sort((a, b) => (b.invite.createdAt || "").localeCompare(a.invite.createdAt || ""));
}

export function createInterview(input: {
  applicationId: string;
  date?: string;
  time?: string;
  startsAt?: string;
  duration?: number;
  type?: InterviewLocationType;
  location?: string;
  interviewer?: string;
  notes?: string;
  status?: InterviewStatus;
}) {
  const detail = getApplicationDetail(input.applicationId);
  if (!detail?.application) return undefined;

  const timestamp = nowIso();
  const startsAt = input.startsAt || `${input.date || timestamp.slice(0, 10)}T${input.time || "15:00"}:00.000Z`;
  const duration = Number.isFinite(input.duration) ? Number(input.duration) : 30;
  const endsAt = new Date(new Date(startsAt).getTime() + duration * 60 * 1000).toISOString();
  const interview: InterviewRecord = {
    id: id("interview", input.applicationId),
    applicationId: input.applicationId,
    storeId: detail.application.storeId,
    scheduledByUserId: getCurrentSession().userId,
    interviewerUserIds: [input.interviewer || getCurrentSession().userId],
    startsAt,
    endsAt,
    locationType: input.type || "in_store",
    locationDetails: input.location || "Store interview",
    status: input.status || "scheduled",
    outcome: input.notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  state().interviews.unshift(interview);
  updateApplicationStage(input.applicationId, "interview", "Scheduled interview");
  return interview;
}

export function createNewCandidateInterview(input: {
  storeId: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  jobId?: string;
  location?: string;
  headline?: string;
  summary?: string;
  date?: string;
  time?: string;
  startsAt?: string;
  duration?: number;
  type?: InterviewLocationType;
  interviewLocation?: string;
  interviewer?: string;
  notes?: string;
}) {
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!name || !email || !email.includes("@")) return undefined;

  const timestamp = nowIso();
  const job = state().applications.length
    ? PUBLIC_JOBS.find((item) => item.storeId === input.storeId && (item.id === input.jobId || item.title === input.role)) ||
      PUBLIC_JOBS.find((item) => item.storeId === input.storeId)
    : PUBLIC_JOBS.find((item) => item.storeId === input.storeId);
  const profileId = id("profile", name);
  const applicationId = id("app", `${name}-${job?.id || input.role || "manual"}`);
  const resumeId = id("resume", name);
  const profile: ApplicantProfileRecord = {
    id: profileId,
    fullName: name,
    email,
    phone: input.phone || "",
    location: input.location || "",
    resumeHeadline: input.headline || input.role || job?.title || "Interview candidate",
    summary: input.summary || "",
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
    stage: "applied",
    submittedAt: timestamp,
    lastActivityAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  state().profiles.unshift(profile);
  state().resumes.unshift(resume);
  state().applications.unshift(application);
  state().stageEvents.unshift({
    id: id("event", `${applicationId}-manual-entry`),
    applicationId,
    toStage: "applied",
    actorUserId: getCurrentSession().userId,
    reason: "Candidate added while scheduling interview",
    createdAt: timestamp,
  });
  const interview = createInterview({
    applicationId,
    date: input.date,
    time: input.time,
    startsAt: input.startsAt,
    duration: input.duration,
    type: input.type,
    location: input.interviewLocation || "Store interview",
    interviewer: input.interviewer,
    notes: input.notes,
  });
  if (!interview) return undefined;
  return { application, profile, resume, job, interview };
}

export function updateInterviewRsvp(interviewId: string, response: "accepted" | "declined" | "tentative") {
  const store = state();
  const interview = store.interviews.find((item) => item.id === interviewId);
  if (!interview) return undefined;

  interview.outcome = `Applicant RSVP: ${response}`;
  interview.updatedAt = nowIso();
  if (response === "declined") interview.status = "cancelled";
  return interview;
}

export function getInterviewRsvpScope(interviewId: string) {
  const interview = state().interviews.find((item) => item.id === interviewId);
  if (!interview) return undefined;
  const detail = getApplicationDetail(interview.applicationId);
  return {
    storeId: interview.storeId,
    recipientEmail: detail?.profile?.email,
  };
}

export function getInterview(interviewId: string) {
  return state().interviews.find((item) => item.id === interviewId);
}

export function getGemMatchInviteScope(inviteId: string) {
  const store = state();
  const invite = store.gemmatchInvites.find((item) => item.id === inviteId);
  const jewelcert = store.jewelcertInvites.find((item) => item.id === inviteId);
  const applicationId = invite?.applicationId || jewelcert?.applicationId;
  if (!applicationId) return undefined;
  const detail = getApplicationDetail(applicationId);
  return {
    storeId: invite?.storeId || jewelcert?.storeId || detail?.application.storeId,
    recipientEmail: detail?.profile?.email,
  };
}

export function updateInterview(input: { interviewId: string; status?: InterviewStatus; notes?: string }) {
  const store = state();
  const interview = store.interviews.find((item) => item.id === input.interviewId);
  if (!interview) return undefined;

  if (input.status) interview.status = input.status;
  if (input.notes !== undefined) interview.outcome = input.notes;
  interview.updatedAt = nowIso();
  return interview;
}

export function getHirePreview(input: { applicationId: string; role?: string; locationId?: string }) {
  const detail = getApplicationDetail(input.applicationId);
  if (!detail?.application || !detail.profile) return undefined;

  const storeId = detail.application.storeId;
  const locationId = input.locationId || "little-rock";
  const composition = getTeamComposition(storeId, locationId);
  const latestGemMatch = detail.gemmatchInvites.find((invite) => invite.resultProfileCode) || detail.gemmatchInvites.at(0);
  const primary = latestGemMatch?.resultProfileCode;
  const incomingMix = profileMix(primary);
  const before = composition.mix;
  const after = blendMix(before, incomingMix, composition.total);
  const role = input.role || detail.job?.title || detail.profile.resumeHeadline || "Associate";
  const courseCredentialIds = detail.resume?.courseCredentialIds || [];
  const teamMemberId = `jl-team-${publicApplicantId(detail.profile.fullName)}`;

  return {
    application: detail.application,
    applicant: detail.profile,
    job: detail.job,
    role,
    locationId,
    storeId,
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
      locationId,
    },
    jewelLinkPayload: {
      teamMemberId,
      fullName: detail.profile.fullName,
      email: detail.profile.email,
      role,
      locationId,
      gemmatchProfile: primary,
      courseCredentialIds,
      sourceApplicationId: detail.application.id,
    },
    existingSync: detail.hireSync || null,
  };
}

export function listHireSyncs(storeId: string, status?: HireToJewelLinkSyncRecord["syncStatus"] | null) {
  return state()
    .hireSyncs.filter((sync) => sync.storeId === storeId)
    .filter((sync) => !status || sync.syncStatus === status)
    .map((sync) => ({
      sync,
      detail: getApplicationDetail(sync.applicationId),
    }));
}

export function getHireSyncForApplication(applicationId: string) {
  const sync = state().hireSyncs.find((item) => item.applicationId === applicationId);
  if (!sync) return undefined;
  return {
    sync,
    detail: getApplicationDetail(applicationId),
  };
}

export function hireApplication(input: { applicationId: string; role?: string; locationId?: string }) {
  const detail = getApplicationDetail(input.applicationId);
  if (!detail?.application || !detail.profile) return undefined;

  const preview = getHirePreview(input);
  if (!preview) return undefined;
  // Idempotency: short-circuit BEFORE mutating stage/history so a repeat hire POST does
  // not churn the application with duplicate no-op hired→hired stage events. Mirrors the
  // postgres branch, which returns the existing sync before writing any stage event.
  const existing = state().hireSyncs.find((sync) => sync.applicationId === input.applicationId);
  if (existing) return existing;
  updateApplicationStage(input.applicationId, "hired", "Confirmed hire and queued JewelLink sync");
  const timestamp = nowIso();

  const primary = preview.gemmatch.primary || undefined;
  const teamMember = addTeamMember(detail.application.storeId, {
    id: preview.jewelLinkPayload.teamMemberId,
    name: detail.profile.fullName,
    initials: applicantInitials(detail.profile.fullName),
    role: preview.role,
    type: preview.gemmatch.type,
    primary: primary || "C",
    locationId: preview.locationId,
  });
  const sync: HireToJewelLinkSyncRecord = {
    id: id("sync", input.applicationId),
    applicationId: input.applicationId,
    storeId: detail.application.storeId,
    jewellinkTeamMemberId: preview.jewelLinkPayload.teamMemberId,
    syncedByUserId: getCurrentSession().userId,
    syncStatus: "synced",
    payloadSnapshot: {
      fullName: detail.profile.fullName,
      role: preview.role,
      gemmatchProfile: primary,
      courseCredentialIds: detail.resume?.courseCredentialIds || [],
    },
    createdAt: timestamp,
    syncedAt: timestamp,
  };
  state().hireSyncs.unshift(sync);
  state().notes.unshift({
    id: id("note", input.applicationId),
    applicationId: input.applicationId,
    storeId: detail.application.storeId,
    authorUserId: getCurrentSession().userId,
    body: `Hired and synced to JewelLink as ${preview.role}. Team member ${teamMember.created ? "created" : "already existed"}.`,
    visibility: "store_internal",
    noteType: "hire_handoff",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return {
    ...sync,
    teamMember: teamMember.member,
    preview: getHirePreview(input),
  };
}
