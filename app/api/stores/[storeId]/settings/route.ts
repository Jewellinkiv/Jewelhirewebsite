import { NextResponse } from "next/server";
import { getSettingsStore } from "@/lib/server/stores/settings-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  return NextResponse.json({ settings: await getSettingsStore().getStoreSettings(params.storeId) });
});

export const PATCH = withApiErrorHandling(async function PATCH(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const settings = await getSettingsStore().updateStoreSettings({
    storeId: params.storeId,
    settings: {
      organization: body?.organization,
      workflow: Array.isArray(body?.workflow) ? body.workflow : undefined,
      notifications: Array.isArray(body?.notifications) ? body.notifications : undefined,
    },
  });
  return NextResponse.json({ settings });
});
