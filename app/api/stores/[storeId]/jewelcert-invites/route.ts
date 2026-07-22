import { NextResponse } from "next/server";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import {
  createPostgresJewelCertInvite,
  getPostgresApplicationDetail,
  listPostgresStoreJewelCertInvites,
} from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { notifyJewelCertInviteCreated } from "@/lib/server/notifications";
import { locationInScope, requireLocationInScope } from "@/lib/server/location-scope";
import { getApplicationDetail, listStoreJewelCertInvites } from "@/lib/local-api-store";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const access = await requireLocationScopedStoreAccess(params.storeId, "jewelcert_invites.list");
  const storeId = access.storeId;
  const candidates = getStorageRuntime() === "postgres"
    ? await listPostgresStoreJewelCertInvites(storeId)
    : listStoreJewelCertInvites(storeId);
  const items = (await Promise.all(candidates.map(async (item) => {
    const detail = getStorageRuntime() === "postgres"
      ? await getPostgresApplicationDetail({ applicationId: item.invite.applicationId, storeId })
      : getApplicationDetail(item.invite.applicationId);
    return locationInScope(detail?.job?.location || detail?.profile?.location, access.locationIds) ? item : undefined;
  }))).filter((item): item is NonNullable<typeof item> => Boolean(item));
  return NextResponse.json({ count: items.length, items });
});

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const access = await requireLocationScopedStoreAccess(params.storeId, "jewelcert_invites.create");
  const storeId = access.storeId;
  const body = await request.json().catch(() => null);
  if (!body?.applicationId) {
    return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
  }
  const detail = getStorageRuntime() === "postgres"
    ? await getPostgresApplicationDetail({ applicationId: body.applicationId, storeId })
    : getApplicationDetail(body.applicationId);
  requireLocationInScope(detail?.job?.location || detail?.profile?.location, access.locationIds, "jewelcert_invites.create");
  const input = {
    storeId,
    applicationId: body.applicationId,
    componentIds: Array.isArray(body.componentIds) ? body.componentIds : undefined,
    courseSlugs: Array.isArray(body.courseSlugs) ? body.courseSlugs : undefined,
  };
  const invite = await (
    getStorageRuntime() === "postgres"
      ? await createPostgresJewelCertInvite({
          ...input,
          actorUserId: access.session.userId,
        })
      : getApplicantStore().createJewelCertInvite(input)
  );
  if (!invite) return NextResponse.json({ error: "Application not found for this store" }, { status: 404 });
  const notification = await notifyJewelCertInviteCreated({
    toEmail: invite.sentToEmail,
    inviteId: invite.id,
    applicationId: invite.applicationId,
    storeId: invite.storeId,
    itemCount: (input.componentIds?.length || 0) + (input.courseSlugs?.length || 0),
  }).catch(() => undefined);
  return NextResponse.json({ invite, notification }, { status: 201 });
});
