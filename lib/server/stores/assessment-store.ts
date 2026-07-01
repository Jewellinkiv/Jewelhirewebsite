import { CustomAssessment, AssessmentKind, AssessmentQuestion } from "@/lib/custom-assessments";
import {
  createJewelCertDecision,
  createStoreAssessment,
  deleteStoreAssessment,
  getAttempt,
  listApplicationJewelCertResults,
  listAssessmentCatalog,
  listAssessmentResults,
  listStoreAssessments,
  setStoreAssessmentStatus,
  updateStoreAssessment,
} from "@/lib/local-assessment-store";
import {
  getCourseCompletionTestForLearner,
  getCourseTestAttempt,
  listCourseCompletionTests,
  listCourseTestAttempts,
  submitCourseTestAttempt,
} from "@/lib/local-course-test-store";
import { requireStoreAccess } from "@/lib/server/access-control";
import {
  createPostgresJewelCertDecision,
  createPostgresStoreAssessment,
  deletePostgresStoreAssessment,
  getPostgresAssessmentResult,
  getPostgresCourseCompletionTestForLearner,
  getPostgresCourseTestAttempt,
  listPostgresApplicationJewelCertResults,
  listPostgresAssessmentResults,
  listPostgresCourseCompletionTests,
  listPostgresCourseTestAttempts,
  listPostgresStoreAssessments,
  setPostgresStoreAssessmentStatus,
  submitPostgresCourseTestAttempt,
  updatePostgresStoreAssessment,
} from "@/lib/server/postgres-phase1";
import { selectStoreAdapter } from "@/lib/server/storage-runtime";

type MaybePromise<T> = T | Promise<T>;

export interface CreateStoreAssessmentInput {
  storeId: string;
  title: string;
  description: string;
  kind: AssessmentKind;
  questions: AssessmentQuestion[];
  status?: CustomAssessment["status"];
}

export interface UpdateStoreAssessmentInput {
  storeId: string;
  assessmentId: string;
  assessment: Partial<CustomAssessment>;
}

export interface SetStoreAssessmentStatusInput {
  storeId: string;
  assessmentId: string;
  status: CustomAssessment["status"];
}

export interface SubmitCourseTestAttemptInput {
  courseSlug: string;
  assignmentId?: string;
  recipientId?: string;
  answers: { questionId: string; answerId?: string; answerIndex?: number }[];
}

export interface AssessmentStore {
  listAssessmentCatalog(): MaybePromise<ReturnType<typeof listAssessmentCatalog>>;
  getAttempt(attemptId: string): MaybePromise<ReturnType<typeof getAttempt>>;
  listAssessmentResults(storeId?: string): MaybePromise<ReturnType<typeof listAssessmentResults>>;
  listApplicationJewelCertResults(applicationId: string): MaybePromise<ReturnType<typeof listApplicationJewelCertResults>>;
  createJewelCertDecision(
    applicationId: string,
    input: { decision: string; note: string },
  ): MaybePromise<ReturnType<typeof createJewelCertDecision> | undefined>;
  listStoreAssessments(storeId: string): MaybePromise<ReturnType<typeof listStoreAssessments>>;
  createStoreAssessment(input: CreateStoreAssessmentInput): MaybePromise<ReturnType<typeof createStoreAssessment> | undefined>;
  updateStoreAssessment(input: UpdateStoreAssessmentInput): MaybePromise<ReturnType<typeof updateStoreAssessment>>;
  setStoreAssessmentStatus(input: SetStoreAssessmentStatusInput): MaybePromise<ReturnType<typeof setStoreAssessmentStatus>>;
  deleteStoreAssessment(input: { storeId: string; assessmentId: string }): MaybePromise<ReturnType<typeof deleteStoreAssessment>>;
  listCourseCompletionTests(): MaybePromise<ReturnType<typeof listCourseCompletionTests>>;
  getCourseCompletionTestForLearner(courseSlug: string): MaybePromise<ReturnType<typeof getCourseCompletionTestForLearner>>;
  listCourseTestAttempts(input?: Parameters<typeof listCourseTestAttempts>[0]): MaybePromise<ReturnType<typeof listCourseTestAttempts>>;
  getCourseTestAttempt(attemptId: string): MaybePromise<ReturnType<typeof getCourseTestAttempt>>;
  submitCourseTestAttempt(input: SubmitCourseTestAttemptInput): MaybePromise<ReturnType<typeof submitCourseTestAttempt>>;
}

const localAssessmentStore: AssessmentStore = {
  listAssessmentCatalog,
  getAttempt,
  listAssessmentResults,
  listApplicationJewelCertResults,
  createJewelCertDecision,
  async listStoreAssessments(storeId) {
    return listStoreAssessments(await requireStoreAccess(storeId, "assessments.list"));
  },
  async createStoreAssessment(input) {
    await requireStoreAccess(input.storeId, "assessments.create");
    return createStoreAssessment(input.storeId, {
      title: input.title,
      description: input.description,
      kind: input.kind,
      questions: input.questions,
      status: input.status,
    });
  },
  async updateStoreAssessment(input) {
    await requireStoreAccess(input.storeId, "assessments.update");
    return updateStoreAssessment(input.storeId, input.assessmentId, input.assessment);
  },
  async setStoreAssessmentStatus(input) {
    await requireStoreAccess(input.storeId, "assessments.status");
    return setStoreAssessmentStatus(input.storeId, input.assessmentId, input.status);
  },
  async deleteStoreAssessment(input) {
    await requireStoreAccess(input.storeId, "assessments.delete");
    return deleteStoreAssessment(input.storeId, input.assessmentId);
  },
  listCourseCompletionTests,
  getCourseCompletionTestForLearner,
  listCourseTestAttempts,
  getCourseTestAttempt,
  submitCourseTestAttempt,
};

const postgresAssessmentStore: AssessmentStore = {
  listAssessmentCatalog,
  getAttempt: getPostgresAssessmentResult,
  listAssessmentResults: listPostgresAssessmentResults,
  listApplicationJewelCertResults: listPostgresApplicationJewelCertResults,
  createJewelCertDecision: createPostgresJewelCertDecision,
  async listStoreAssessments(storeId) {
    return listPostgresStoreAssessments(await requireStoreAccess(storeId, "assessments.list"));
  },
  async createStoreAssessment(input) {
    return createPostgresStoreAssessment({
      ...input,
      storeId: await requireStoreAccess(input.storeId, "assessments.create"),
    });
  },
  async updateStoreAssessment(input) {
    return updatePostgresStoreAssessment({
      ...input,
      storeId: await requireStoreAccess(input.storeId, "assessments.update"),
    });
  },
  async setStoreAssessmentStatus(input) {
    return setPostgresStoreAssessmentStatus({
      ...input,
      storeId: await requireStoreAccess(input.storeId, "assessments.status"),
    });
  },
  async deleteStoreAssessment(input) {
    return deletePostgresStoreAssessment({
      ...input,
      storeId: await requireStoreAccess(input.storeId, "assessments.delete"),
    });
  },
  listCourseCompletionTests: listPostgresCourseCompletionTests,
  getCourseCompletionTestForLearner: getPostgresCourseCompletionTestForLearner,
  listCourseTestAttempts: listPostgresCourseTestAttempts,
  getCourseTestAttempt: getPostgresCourseTestAttempt,
  submitCourseTestAttempt: submitPostgresCourseTestAttempt,
};

export function getAssessmentStore(): AssessmentStore {
  return selectStoreAdapter("assessment-store", {
    local: localAssessmentStore,
    postgres: postgresAssessmentStore,
  });
}
