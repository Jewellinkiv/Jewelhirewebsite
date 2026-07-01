import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { checkPostgresReadiness } from "@/lib/server/postgres-readiness";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET() {
  const report = await checkPostgresReadiness();
  return NextResponse.json(report, {
    status: report.ok ? 200 : report.configured ? 503 : 200,
  });
});
