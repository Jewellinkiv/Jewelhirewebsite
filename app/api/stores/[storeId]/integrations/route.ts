import { NextResponse } from "next/server";
import { getSettingsStore } from "@/lib/server/stores/settings-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const items = await getSettingsStore().listStoreIntegrations(params.storeId);
  return NextResponse.json({ count: items.length, items });
});
