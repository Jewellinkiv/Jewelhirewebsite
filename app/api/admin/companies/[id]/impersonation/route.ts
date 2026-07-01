import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getAdminStore } from "@/lib/server/stores/admin-store";

export const dynamic = "force-dynamic";

export const POST = withApiErrorHandling(async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requireAdminAccess("admin.impersonation.start");
  const result = await getAdminStore().startImpersonation(params.id);
  if (!result) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  return NextResponse.json(result, { status: 201 });
});
