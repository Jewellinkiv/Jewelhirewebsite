import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getAdminStore } from "@/lib/server/stores/admin-store";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET() {
  await requireAdminAccess("admin.billing.read");
  return NextResponse.json(await getAdminStore().getBilling());
});
