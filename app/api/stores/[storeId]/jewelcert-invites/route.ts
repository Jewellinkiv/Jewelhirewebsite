import { NextResponse } from "next/server";
import { getSessionContext, requireStoreAccess } from "@/lib/server/access-control";
import {
  createPostgresJewelCertInvite,
  listPostgresStoreJewelCertInvites,
} from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { notifyJewelCertInviteCreated } from "@/lib/server/notifications";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "jewelcert_invites.list");
  const items = await (
    getStorageRuntime() === "postgres"
      ? await listPostgresStoreJewelCertInvites(storeId)
      : getApplicantStore().listStoreJewelCertInvites(storeId)
  );
  return NextResponse.json({ count: items.length, items });
});

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  if (!body?.applicationId) {
    return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
  }

  const storeId = await requireStoreAccess(params.storeId, "jewelcert_invites.create");
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
          actorUserId: (await getSessionContext()).userId,
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
  });
  return NextResponse.json({ invite, notification }, { status: 201 });
});
