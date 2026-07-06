import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { checkPostgresReadiness } from "@/lib/server/postgres-readiness";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET() {
  await requireAdminAccess("admin.database.readiness.read");
  const report = await checkPostgresReadiness();
  return NextResponse.json(report, {
    status: report.ok ? 200 : report.configured ? 503 : 200,
  });
});
