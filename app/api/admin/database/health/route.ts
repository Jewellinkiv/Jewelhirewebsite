import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { checkPostgresHealth } from "@/lib/server/postgres";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET() {
  await requireAdminAccess("admin.database.health.read");
  const status = await checkPostgresHealth();
  return NextResponse.json(status, { status: status.ok ? 200 : status.configured ? 503 : 200 });
});
