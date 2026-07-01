import { NextResponse } from "next/server";
import { CalProvider } from "@/lib/invite-settings";
import { getSettingsStore } from "@/lib/server/stores/settings-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

const providers: CalProvider[] = ["google", "microsoft"];

export const POST = withApiErrorHandling(async function POST(_request: Request, props: { params: Promise<{ storeId: string; provider: string }> }) {
  const params = await props.params;
  if (!providers.includes(params.provider as CalProvider)) {
    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  }
  return NextResponse.json(await getSettingsStore().connectStoreIntegration({ storeId: params.storeId, provider: params.provider as CalProvider }));
});

export const DELETE = withApiErrorHandling(async function DELETE(_request: Request, props: { params: Promise<{ storeId: string; provider: string }> }) {
  const params = await props.params;
  if (!providers.includes(params.provider as CalProvider)) {
    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  }
  const result = await getSettingsStore().disconnectStoreIntegration({ storeId: params.storeId, provider: params.provider as CalProvider });
  if (!result) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  return NextResponse.json(result);
});
