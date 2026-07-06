import { NextResponse } from "next/server";
import { CalProvider } from "@/lib/invite-settings";
import { requireStoreAccess } from "@/lib/server/access-control";
import { getSettingsStore } from "@/lib/server/stores/settings-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

const providers: CalProvider[] = ["google", "microsoft"];

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "invite_settings.read");
  return NextResponse.json({ inviteSettings: await getSettingsStore().getStoreInviteSettings(storeId) });
});

export const PUT = withApiErrorHandling(async function PUT(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "invite_settings.update");
  const body = await request.json().catch(() => null);
  const calendarProvider = body?.calendarProvider === null || providers.includes(body?.calendarProvider) ? body.calendarProvider : undefined;
  const nextInviteSettings = {
    ...(calendarProvider !== undefined ? { calendarProvider } : {}),
    ...(typeof body?.account === "string" ? { account: body.account } : {}),
    ...(typeof body?.fromName === "string" ? { fromName: body.fromName } : {}),
    ...(typeof body?.replyTo === "string" ? { replyTo: body.replyTo } : {}),
    ...(typeof body?.timezone === "string" ? { timezone: body.timezone } : {}),
    ...(typeof body?.defaultDuration === "string" ? { defaultDuration: body.defaultDuration } : {}),
    ...(typeof body?.location === "string" ? { location: body.location } : {}),
    ...(typeof body?.addLinks === "boolean" ? { addLinks: body.addLinks } : {}),
    ...(typeof body?.attachIcs === "boolean" ? { attachIcs: body.attachIcs } : {}),
    ...(typeof body?.remind24 === "boolean" ? { remind24: body.remind24 } : {}),
    ...(typeof body?.remind1 === "boolean" ? { remind1: body.remind1 } : {}),
    ...(typeof body?.noteTemplate === "string" ? { noteTemplate: body.noteTemplate } : {}),
  };
  const inviteSettings = await getSettingsStore().updateStoreInviteSettings({
    storeId,
    inviteSettings: nextInviteSettings,
  });
  return NextResponse.json({ inviteSettings });
});
