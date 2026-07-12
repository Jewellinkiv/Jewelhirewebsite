import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresCareersAnalytics } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { CAREERS } from "@/lib/dashboard";

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  await requireStoreAccess(params.storeId, "careers_analytics.read");
  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "30d";
  const requestedDays = Number(range.replace(/d$/i, ""));
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const careers = getStorageRuntime() === "postgres"
    ? await getPostgresCareersAnalytics(params.storeId, days)
    : CAREERS;
  return NextResponse.json({
    storeId: params.storeId,
    range: `${days}d`,
    careers,
  });
});
