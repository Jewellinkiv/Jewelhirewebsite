import { NextResponse } from "next/server";
import { getSettingsStore } from "@/lib/server/stores/settings-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const toUserId = typeof body?.toUserId === "string" ? body.toUserId : "";
  if (!toUserId) return NextResponse.json({ error: "toUserId is required" }, { status: 400 });

  const result = await getSettingsStore().transferStoreAdmin({ storeId: params.storeId, toUserId });
  if (!result) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(result);
});
