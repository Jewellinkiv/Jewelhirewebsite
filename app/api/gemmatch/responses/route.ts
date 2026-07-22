import { NextResponse } from "next/server";
import { requireRecipientOrStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { notifyAssessmentCompleted } from "@/lib/server/notifications";
import { completePostgresGemMatchResponse, getPostgresGemMatchCompletionNotificationContext, getPostgresGemMatchInviteScope } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getApplicationDetail, getGemMatchInviteScope } from "@/lib/local-api-store";
import { listStoreUsers } from "@/lib/local-settings-store";
import { syncPostgresJewelCertResultToJewelLink } from "@/lib/server/jewellink-integration";

// Resolve the store's manager contact in the in-memory runtime so the manager
// JewelCert-completed email fires in local too (mirrors the postgres notification
// context + the public-applications manager-contact resolution: Active Admin,
// else any Active user).
function localManagerContact(storeId: string) {
  const users = listStoreUsers(storeId);
  const manager =
    users.find((user) => user.status === "Active" && user.role === "Admin")
    || users.find((user) => user.status === "Active");
  return manager ? { name: manager.name, email: manager.email } : undefined;
}

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
    resultLabel: "JewelCert",
  };
  const [candidate, manager] = await Promise.all([
    notifyAssessmentCompleted({
      ...common,
      recipientRole: "candidate",
      toEmail: context.candidateEmail,
      recipientName: context.candidateName,
    }).catch(() => undefined),
    notifyAssessmentCompleted({
      ...common,
      recipientRole: "manager",
      toEmail: context.managerEmail,
      recipientName: context.managerName,
    }).catch(() => undefined),
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
  const scope = isPostgres ? await getPostgresGemMatchInviteScope(input.inviteId) : getGemMatchInviteScope(input.inviteId);
  if (!scope) return NextResponse.json({ error: "JewelCert invite not found" }, { status: 404 });
  await requireRecipientOrStoreAccess({ ...scope, operation: "gemmatch.responses.create" });

  const result = isPostgres
    ? await completePostgresGemMatchResponse(input)
    : getApplicantStore().completeGemMatchResponse(input);
  if (!result) return NextResponse.json({ error: "JewelCert invite not found" }, { status: 404 });
  const context = isPostgres
    ? await getPostgresGemMatchCompletionNotificationContext(result.invite?.id || body.inviteId)
    : (() => {
        const invite = result.invite;
        const detail = invite?.applicationId ? getApplicationDetail(invite.applicationId) : undefined;
        if (!detail) return undefined;
        const manager = localManagerContact(detail.application.storeId);
        return {
          applicationId: detail.application.id,
          storeId: detail.application.storeId,
          candidateName: detail.profile?.fullName,
          candidateEmail: detail.profile?.email,
          jobTitle: detail.job?.title,
          managerName: manager?.name,
          managerEmail: manager?.email,
        };
      })();
  // Only notify on the genuine started->completed transition. A repeat POST for
  // an already-completed invite re-runs completion but must not re-send the
  // candidate + manager "assessment completed" emails (same idempotency guard
  // the hire route uses for its "you've been hired" email).
  const notifications = result.wasAlreadyCompleted ? [] : await notifyCompletion(context);
  const jewelLinkSync = isPostgres && result.invite?.id
    ? await syncPostgresJewelCertResultToJewelLink(result.invite.id)
    : undefined;
  return NextResponse.json({ ...result, notifications, jewelLinkSync });
});
