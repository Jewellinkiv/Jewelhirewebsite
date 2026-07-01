import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getAdminStore } from "@/lib/server/stores/admin-store";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(request: Request) {
  await requireAdminAccess("admin.support.read");
  const url = new URL(request.url);
  return NextResponse.json(await getAdminStore().getSupport(url.searchParams.get("q") ?? ""));
});
