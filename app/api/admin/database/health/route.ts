import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { checkPostgresHealth } from "@/lib/server/postgres";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET() {
  const status = await checkPostgresHealth();
  return NextResponse.json(status, { status: status.ok ? 200 : status.configured ? 503 : 200 });
});
