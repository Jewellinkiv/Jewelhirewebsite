import { NextResponse } from "next/server";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { AccessDeniedError } from "@/lib/server/access-errors";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { canonicalLocationId, locationIdInScope } from "@/lib/server/location-scope";
import { getPostgresApplicationDetail, getPostgresApplicationStoreId, getPostgresHirePreview, getPostgresHireSyncForApplication, hirePostgresApplication, listPostgresStoreLocations } from "@/lib/server/postgres-phase1";
import { notifyCandidateHired } from "@/lib/server/notifications";
import { listStoreLocations } from "@/lib/local-team-store";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicationDetail, getHireSyncForApplication } from "@/lib/local-api-store";
import { syncPostgresHireToJewelLink } from "@/lib/server/jewellink-integration";

async function notifyHire(
  detail: { profile?: { fullName?: string | null; email?: string | null } | null; job?: { title?: string | null } | null } | undefined,
  input: { applicationId: string; storeId: string; role?: string | null },
) {
  if (!detail) return undefined;
  // The hire DB write is already committed by the time we get here. A notification
  // failure (e.g. a transient Postmark network error, which makes sendNotification's
  // fetch reject) must never surface as a 500 on an already-successful hire — that
  // would tell the client the hire failed and, on retry, the idempotency guard would
  // suppress the email entirely. Swallow send failures, mirroring the .catch(() =>
  // undefined) used on the other awaited side-effects in this route.
  return notifyCandidateHired({
    toEmail: detail.profile?.email,
    recipientName: detail.profile?.fullName,
    applicationId: input.applicationId,
    storeId: input.storeId,
    role: input.role,
    jobTitle: detail.job?.title,
  }).catch(() => undefined);
}

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const requestedRole = typeof body?.role === "string" ? body.role.trim() || undefined : undefined;
  const requestedLocationId = typeof body?.locationId === "string" ? body.locationId.trim() || undefined : undefined;
  if (getStorageRuntime() === "postgres") {
    const storeId = await getPostgresApplicationStoreId(params.id);
    if (!storeId) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    const access = await requireLocationScopedStoreAccess(storeId, "hire.confirm");
    const current = await getPostgresApplicationDetail({ applicationId: params.id, storeId });
    const role = current?.job?.title || requestedRole || current?.profile?.resumeHeadline || "Associate";
    const requestedLocation = current?.job?.location || requestedLocationId;
    const locationId = canonicalLocationId(await listPostgresStoreLocations(storeId), requestedLocation);
    if (!locationId) {
      return NextResponse.json({ error: "The hiring location is missing or no longer available." }, { status: 409 });
    }
    if (!locationIdInScope(locationId, access.locationIds)) {
      throw new AccessDeniedError("Location is not in scope for hire.confirm.target");
    }
    // hirePostgresApplication is idempotent — a repeat POST returns the existing sync
    // instead of creating one. Only fire the "you've been hired" email when THIS call
    // actually performs a new hire, so repeat POSTs don't re-notify the candidate.
    const alreadyHired = Boolean(await getPostgresHireSyncForApplication(params.id).catch(() => undefined));
    const sync = await hirePostgresApplication({
      applicationId: params.id,
      storeId,
      actorUserId: access.session.userId,
      role,
      locationId,
    });
    if (!sync) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    const provisionedSync = await syncPostgresHireToJewelLink(params.id);
    const detail = alreadyHired
      ? undefined
      : await getPostgresApplicationDetail({ applicationId: params.id, storeId }).catch(() => undefined);
    const notification = alreadyHired
      ? undefined
      : await notifyHire(detail, { applicationId: params.id, storeId, role });
    return NextResponse.json({
      hireSync: provisionedSync || sync,
      preview: await getPostgresHirePreview({
        applicationId: params.id,
        storeId,
        role,
        locationId,
      }),
      notification,
    });
  }

  const store = getApplicantStore();
  const current = getApplicationDetail(params.id);
  if (!current) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  const access = await requireLocationScopedStoreAccess(current.application.storeId, "hire.confirm");
  const role = current.job?.title || requestedRole || current.profile?.resumeHeadline || "Associate";
  const locationId = canonicalLocationId(
    listStoreLocations(current.application.storeId),
    current.job?.location || requestedLocationId,
  );
  if (!locationId) {
    return NextResponse.json({ error: "The hiring location is missing or no longer available." }, { status: 409 });
  }
  if (!locationIdInScope(locationId, access.locationIds)) {
    throw new AccessDeniedError("Location is not in scope for hire.confirm.target");
  }
  // Same idempotency guard as the postgres branch: hireApplication returns the existing
  // sync on a repeat POST, so only notify when this call is a genuinely new hire.
  const alreadyHired = Boolean(getHireSyncForApplication(params.id));
  const sync = store.hireApplication({
    applicationId: params.id,
    role,
    locationId,
  });

  if (!sync) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  const detail = alreadyHired ? undefined : current;
  const notification = alreadyHired
    ? undefined
    : await notifyHire(detail, {
        applicationId: params.id,
        storeId: detail?.application.storeId || "",
        role,
      });
  return NextResponse.json({
    hireSync: sync,
    preview: store.getHirePreview({
      applicationId: params.id,
      role,
      locationId,
    }),
    notification,
  });
});
