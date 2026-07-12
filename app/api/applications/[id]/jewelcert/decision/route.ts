import { NextResponse } from "next/server";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { requireLocationInScope } from "@/lib/server/location-scope";
import { createJewelCertDecision } from "@/lib/local-assessment-store";
import {
  createPostgresJewelCertDecision,
  getPostgresApplicationDetail,
  getPostgresApplicationStoreId,
} from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicationDetail } from "@/lib/local-api-store";

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const decision = typeof body?.decision === "string" ? body.decision : "";
  const note = typeof body?.note === "string" ? body.note : "";
  if (!decision) return NextResponse.json({ error: "decision is required" }, { status: 400 });

  if (getStorageRuntime() === "postgres") {
    const storeId = await getPostgresApplicationStoreId(params.id);
    if (!storeId) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    const access = await requireLocationScopedStoreAccess(storeId, "jewelcert.decision");
    const detail = await getPostgresApplicationDetail({ applicationId: params.id, storeId });
    requireLocationInScope(detail?.job?.location || detail?.profile?.location, access.locationIds, "jewelcert.decision");
    const record = await createPostgresJewelCertDecision(params.id, { decision, note });
    if (!record) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    return NextResponse.json({ decision: record }, { status: 201 });
  }

  const detail = getApplicationDetail(params.id);
  if (!detail) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  const access = await requireLocationScopedStoreAccess(detail.application.storeId, "jewelcert.decision");
  requireLocationInScope(detail.job?.location || detail.profile?.location, access.locationIds, "jewelcert.decision");
  const record = createJewelCertDecision(params.id, { decision, note });
  if (!record) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  return NextResponse.json({ decision: record }, { status: 201 });
});
