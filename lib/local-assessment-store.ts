import { ASSESSMENT_RESULTS, AssessmentResult, COMPLETED_RESULTS } from "./assessment-results";
import { CustomAssessment, AssessmentKind, AssessmentQuestion, CUSTOM_ASSESSMENTS } from "./custom-assessments";
import { LEGACY_ASSESSMENTS } from "./legacy";

interface AssessmentState {
  customByStoreId: Record<string, CustomAssessment[]>;
  results: Record<string, AssessmentResult>;
  decisions: Record<string, { applicationId: string; decision: string; note: string; createdAt: string }[]>;
}

declare global {
  // eslint-disable-next-line no-var
  var __jewelhireAssessmentStore: AssessmentState | undefined;
}

function state(): AssessmentState {
  if (!globalThis.__jewelhireAssessmentStore) {
    globalThis.__jewelhireAssessmentStore = {
      customByStoreId: {},
      results: structuredClone(ASSESSMENT_RESULTS),
      decisions: {},
    };
  }
  return globalThis.__jewelhireAssessmentStore;
}

function ensureStoreAssessments(storeId: string) {
  state().customByStoreId[storeId] ??= structuredClone(CUSTOM_ASSESSMENTS);
  return state().customByStoreId[storeId];
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function listAssessmentCatalog() {
  return {
    items: [
      {
        id: "gemmatch",
        title: "JewelCert",
        type: "Trait profile",
        durationMinutes: 3,
        questionCount: 48,
        owner: "Admin",
        status: "Published",
        targets: ["Visionary", "Connector", "Foundation", "Determined"],
        media: [],
      },
      ...LEGACY_ASSESSMENTS.map((assessment) => ({
        id: slugify(assessment.title),
        ...assessment,
        owner: "Admin",
        status: "Published",
      })),
    ],
  };
}

export function listStoreAssessments(storeId: string) {
  return ensureStoreAssessments(storeId).map((assessment) => structuredClone(assessment));
}

export function createStoreAssessment(storeId: string, input: {
  title: string;
  description: string;
  kind: AssessmentKind;
  questions: AssessmentQuestion[];
  status?: CustomAssessment["status"];
}) {
  const assessment: CustomAssessment = {
    id: `ca-${slugify(input.title) || Date.now().toString(36)}`,
    title: input.title.trim(),
    description: input.description.trim(),
    kind: input.kind,
    owner: "Store",
    status: input.status || "Draft",
    questions: structuredClone(input.questions),
    updated: todayLabel(),
  };
  const assessments = ensureStoreAssessments(storeId);
  const existingIndex = assessments.findIndex((item) => item.id === assessment.id);
  if (existingIndex >= 0) assessments.splice(existingIndex, 1, assessment);
  else assessments.unshift(assessment);
  return structuredClone(assessment);
}

export function updateStoreAssessment(storeId: string, id: string, input: Partial<CustomAssessment>) {
  const assessments = ensureStoreAssessments(storeId);
  const assessment = assessments.find((item) => item.id === id);
  if (!assessment) return undefined;
  if (input.title) assessment.title = input.title;
  if (input.description !== undefined) assessment.description = input.description;
  if (input.kind) assessment.kind = input.kind;
  if (input.questions) assessment.questions = structuredClone(input.questions);
  if (input.status) assessment.status = input.status;
  assessment.updated = todayLabel();
  return structuredClone(assessment);
}

export function setStoreAssessmentStatus(storeId: string, id: string, status: CustomAssessment["status"]) {
  return updateStoreAssessment(storeId, id, { status });
}

export function deleteStoreAssessment(storeId: string, id: string) {
  const assessments = ensureStoreAssessments(storeId);
  const assessment = assessments.find((item) => item.id === id);
  if (!assessment) return undefined;
  state().customByStoreId[storeId] = assessments.filter((item) => item.id !== id);
  return structuredClone(assessment);
}

export function listAssessmentResults() {
  return Object.values(state().results).map((result) => structuredClone(result));
}

export function getAttempt(attemptId: string) {
  const result = state().results[attemptId] || Object.values(state().results).find((item) => item.slug === attemptId);
  return result ? structuredClone(result) : undefined;
}

export function listApplicationJewelCertResults(_applicationId: string) {
  return listAssessmentResults();
}

export function createJewelCertDecision(applicationId: string, input: { decision: string; note: string }) {
  state().decisions[applicationId] ??= [];
  const record = {
    applicationId,
    decision: input.decision.trim(),
    note: input.note.trim(),
    createdAt: new Date().toISOString(),
  };
  state().decisions[applicationId].unshift(record);
  return record;
}
