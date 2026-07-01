import { NextResponse } from "next/server";
import { getSessionContext, requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { createPostgresInterview, getPostgresApplicationStoreId } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

const locationTypes = new Set(["in_store", "phone", "video"]);

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  if (getStorageRuntime() === "postgres") {
    const storeId = await getPostgresApplicationStoreId(params.id);
    if (!storeId) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    await requireStoreAccess(storeId, "interviews.create");
    const session = await getSessionContext();
    const interview = await createPostgresInterview({
      applicationId: params.id,
      storeId,
      actorUserId: session.userId,
      date: body?.date,
      time: body?.time,
      startsAt: body?.startsAt,
      duration: Number.isFinite(Number(body?.duration)) ? Number(body.duration) : undefined,
      type: locationTypes.has(body?.type) ? body.type : undefined,
      location: body?.location || body?.locationDetails,
      interviewer: body?.interviewer,
      notes: body?.notes,
    });
    if (!interview) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    return NextResponse.json({ interview }, { status: 201 });
  }

  const interview = getApplicantStore().createInterview({
    applicationId: params.id,
    date: body?.date,
    time: body?.time,
    startsAt: body?.startsAt,
    duration: body?.duration,
    type: body?.type,
    location: body?.location || body?.locationDetails,
    interviewer: body?.interviewer,
    notes: body?.notes,
  });

  if (!interview) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  return NextResponse.json({ interview }, { status: 201 });
});
