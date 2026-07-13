import { NextResponse } from "next/server";
import { ApplicationStage } from "@/lib/applicant-lifecycle";
import { getSessionContext, requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { requireLocationInScope } from "@/lib/server/location-scope";
import {
  getPostgresApplicationDetail,
  getPostgresApplicationStoreId,
  updatePostgresApplicationStage,
} from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getApplicationDetail } from "@/lib/local-api-store";

const STAGES = new Set<ApplicationStage>([
  "applied",
  "jewelcert",
  "gemmatch",
  "interview",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
]);

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const toStage = body?.toStage;
  if (!STAGES.has(toStage)) {
    return NextResponse.json({ error: "Valid toStage is required" }, { status: 400 });
  }
  const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : `Moved to ${toStage}`;

  if (getStorageRuntime() === "postgres") {
    const storeId = await getPostgresApplicationStoreId(params.id);
    if (!storeId) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    const access = await requireLocationScopedStoreAccess(storeId, "applications.stage");
    const current = await getPostgresApplicationDetail({ applicationId: params.id, storeId });
    requireLocationInScope(current?.job?.location || current?.profile?.location, access.locationIds, "applications.stage");
    const detail = await updatePostgresApplicationStage({
      applicationId: params.id,
      storeId,
      toStage,
      reason,
      actorUserId: (await getSessionContext()).userId,
    });
    if (!detail) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    return NextResponse.json(detail);
  }

  const current = getApplicationDetail(params.id);
  if (!current) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  const access = await requireLocationScopedStoreAccess(current.application.storeId, "applications.stage");
  requireLocationInScope(current.job?.location || current.profile?.location, access.locationIds, "applications.stage");
  const detail = getApplicantStore().updateApplicationStage({
    applicationId: params.id,
    toStage,
    reason,
  });
  if (!detail) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  return NextResponse.json(detail);
});
