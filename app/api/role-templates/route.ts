import { NextResponse } from "next/server";
import { listRoleTemplates } from "@/lib/role-templates";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(function GET() {
  const items = listRoleTemplates();
  return NextResponse.json({ count: items.length, items });
});
