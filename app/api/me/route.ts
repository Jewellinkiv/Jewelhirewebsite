import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET() {
  return NextResponse.json(await getSessionContext());
});
