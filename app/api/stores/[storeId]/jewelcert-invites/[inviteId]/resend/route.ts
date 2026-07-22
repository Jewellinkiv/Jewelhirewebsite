import { NextResponse } from "next/server";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { locationInScope } from "@/lib/server/location-scope";
import { notifyJewelCertInviteCreated } from "@/lib/server/notifications";
import {
  getPostgresApplicationDetail,
  listPostgresStoreJewelCertInvites,
} from "@/lib/server/postgres-phase1";
import { rateLimit } from "@/lib/server/rate-limit";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicationDetail, listStoreJewelCertInvites } from "@/lib/local-api-store";

const RESENDABLE_STATUSES = new Set(["sent", "started"]);

export const POST = withApiErrorHandling(async function POST(
  _request: Request,
  props: { params: Promise<{ storeId: string; inviteId: string }> },
) {
  const params = await props.params;
  const access = await requireLocationScopedStoreAccess(params.storeId, "jewelcert_invites.resend");
  const storeId = access.storeId;
  const inviteRows = getStorageRuntime() === "postgres"
    ? await listPostgresStoreJewelCertInvites(storeId)
    : listStoreJewelCertInvites(storeId);
  const row = inviteRows.find((item) => item.invite.id === params.inviteId);
  if (!row) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });

  const detail = getStorageRuntime() === "postgres"
    ? await getPostgresApplicationDetail({ applicationId: row.invite.applicationId, storeId })
    : getApplicationDetail(row.invite.applicationId);
  if (!locationInScope(detail?.job?.location || detail?.profile?.location, access.locationIds)) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }
  if (!RESENDABLE_STATUSES.has(row.invite.status)) {
    return NextResponse.json(
      { error: "Only pending JewelCert invitations can be resent" },
      { status: 409 },
    );
  }

  // One accepted click is enough. This shared limiter stops double-clicks and
  // concurrent Cloud Run instances from sending the same invitation twice.
  const resendLimit = await rateLimit(
    `jewelcert-resend:${row.invite.id}`,
    1,
    60,
  );
  if (!resendLimit.ok) {
    return NextResponse.json(
      { error: "This invitation was just resent. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(resendLimit.retryAfterSeconds) } },
    );
  }

  const itemCount = row.invite.assessmentPackageId.split("+").filter(Boolean).length || 1;
  const notification = await notifyJewelCertInviteCreated({
    toEmail: row.invite.sentToEmail,
    recipientName: row.candidate?.name,
    inviteId: row.invite.id,
    applicationId: row.invite.applicationId,
    storeId: row.invite.storeId,
    itemCount,
  }).catch(() => {
    return {
      status: "failed" as const,
      provider: "postmark" as const,
      delivery: "ambiguous" as const,
      reason: "notification_exception",
    };
  });
  if (notification.status !== "sent" || notification.delivery !== "accepted") {
    return NextResponse.json(
      { error: "The invitation email was not accepted. Please try again later." },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, inviteId: row.invite.id });
});
