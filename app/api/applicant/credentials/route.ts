import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresApplicantResume, listPostgresApplicantTraining } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export const dynamic = "force-dynamic";

type TrainingLike = {
  id: string;
  course: string;
  package?: string;
  assignedBy?: string;
  progress?: number;
  status?: string;
  credentialed?: boolean;
  credentialId?: string;
  lastActivityAt?: string;
};

type ApplicantCredential = {
  id: string;
  course: string;
  title: string;
  issuer: string;
  package?: string;
  completed: boolean;
  completedOn?: string;
  assignmentId?: string;
  onResume: boolean;
};

function credentialIdForAssignment(item: TrainingLike) {
  return item.credentialId || `course-credential-${item.id}`;
}

function buildCredentials(resumePayload: { resume?: { courseCredentialIds?: string[] } } | undefined, training: TrainingLike[]) {
  const resumeIds = new Set(resumePayload?.resume?.courseCredentialIds || []);
  const completedTraining = training.filter((item) => item.credentialed || item.status === "Completed" || Number(item.progress || 0) >= 100);
  const items: ApplicantCredential[] = completedTraining.map((item) => {
    const credentialId = credentialIdForAssignment(item);
    return {
      id: resumeIds.has(credentialId) ? credentialId : item.credentialId || item.id,
      course: item.course,
      title: item.course,
      issuer: item.assignedBy || "JewelHire",
      package: item.package,
      completed: true,
      completedOn: item.lastActivityAt,
      assignmentId: item.id,
      onResume: resumeIds.has(credentialId) || resumeIds.has(item.id),
    };
  });

  for (const id of resumeIds) {
    if (!items.some((item) => item.id === id)) {
      items.push({
        id,
        course: "Course credential",
        title: "Course credential",
        issuer: "JewelHire",
        completed: true,
        onResume: true,
      });
    }
  }

  return items;
}

export const GET = withApiErrorHandling(async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");

  if (getStorageRuntime() === "postgres") {
    const resume = await getPostgresApplicantResume(email);
    const training = await listPostgresApplicantTraining(email);
    const items = buildCredentials(resume, training);
    return NextResponse.json({ count: items.length, items });
  }

  const resume = getApplicantStore().getApplicantResume(email);
  const training = getApplicantStore().listApplicantTraining(email);
  const items = buildCredentials(resume, training);
  return NextResponse.json({ count: items.length, items });
});
