import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { notifyAssessmentCompleted } from "@/lib/server/notifications";
import { completePostgresGemMatchResponse, getPostgresGemMatchCompletionNotificationContext } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getApplicationDetail } from "@/lib/local-api-store";

async function notifyCompletion(context?: {
  applicationId?: string;
  storeId?: string;
  candidateName?: string | null;
  candidateEmail?: string | null;
  jobTitle?: string | null;
  managerName?: string | null;
  managerEmail?: string | null;
}) {
  if (!context?.applicationId || !context.storeId) return [];
  const common = {
    applicationId: context.applicationId,
    storeId: context.storeId,
    candidateName: context.candidateName,
    jobTitle: context.jobTitle,
    resultLabel: "GemMatch",
  };
  const [candidate, manager] = await Promise.all([
    notifyAssessmentCompleted({
      ...common,
      recipientRole: "candidate",
      toEmail: context.candidateEmail,
      recipientName: context.candidateName,
    }),
    notifyAssessmentCompleted({
      ...common,
      recipientRole: "manager",
      toEmail: context.managerEmail,
      recipientName: context.managerName,
    }),
  ]);
  return [
    { recipientRole: "candidate", ...candidate },
    { recipientRole: "manager", ...manager },
  ];
}

export const POST = withApiErrorHandling(async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.inviteId) {
    return NextResponse.json({ error: "inviteId is required" }, { status: 400 });
  }

  const input = {
    inviteId: body.inviteId,
    pickedAdjectiveIds: Array.isArray(body.pickedAdjectiveIds) ? body.pickedAdjectiveIds : undefined,
  };
  const isPostgres = getStorageRuntime() === "postgres";
  const result = isPostgres
    ? await completePostgresGemMatchResponse(input)
    : getApplicantStore().completeGemMatchResponse(input);
  if (!result) return NextResponse.json({ error: "GemMatch invite not found" }, { status: 404 });
  const context = isPostgres
    ? await getPostgresGemMatchCompletionNotificationContext(result.invite?.id || body.inviteId)
    : (() => {
        const invite = result.invite;
        const detail = invite?.applicationId ? getApplicationDetail(invite.applicationId) : undefined;
        return detail
          ? {
              applicationId: detail.application.id,
              storeId: detail.application.storeId,
              candidateName: detail.profile?.fullName,
              candidateEmail: detail.profile?.email,
              jobTitle: detail.job?.title,
            }
          : undefined;
      })();
  const notifications = await notifyCompletion(context);
  return NextResponse.json({ ...result, notifications });
});
