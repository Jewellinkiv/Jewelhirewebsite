import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getAdminStore } from "@/lib/server/stores/admin-store";

export const dynamic = "force-dynamic";

const KINDS = ["Trait profile", "Aptitude", "Knowledge check"] as const;

export const GET = withApiErrorHandling(async function GET() {
  await requireAdminAccess("admin.assessments.list");
  const items = await getAdminStore().listAssessments();
  return NextResponse.json({ count: items.length, items });
});

export const POST = withApiErrorHandling(async function POST(request: NextRequest) {
  await requireAdminAccess("admin.assessments.create");
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: { code: "invalid", message: "A name is required." } }, { status: 400 });
  }
  if (!KINDS.includes(body.kind)) {
    return NextResponse.json({ error: { code: "invalid", message: "A valid kind is required." } }, { status: 400 });
  }
  const assessment = await getAdminStore().createAssessment({
    name,
    kind: body.kind,
    scope: typeof body.scope === "string" ? body.scope : undefined,
    status: body.status === "Published" ? "Published" : "Draft",
    questions: Number.isFinite(body.questions) ? Number(body.questions) : 0,
    note: typeof body.note === "string" ? body.note : undefined,
  });
  return NextResponse.json({ assessment }, { status: 201 });
});
