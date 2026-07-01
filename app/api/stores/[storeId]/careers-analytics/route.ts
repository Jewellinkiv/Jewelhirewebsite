import { NextResponse } from "next/server";
import { CAREERS } from "@/lib/dashboard";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  await requireStoreAccess(params.storeId, "careers_analytics.read");
  const url = new URL(request.url);
  return NextResponse.json({
    storeId: params.storeId,
    range: url.searchParams.get("range") || "30d",
    careers: CAREERS,
  });
});
