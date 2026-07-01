import { NextResponse } from "next/server";
import { InterviewStatus } from "@/lib/applicant-lifecycle";
import { getSessionContext, requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresInterviewStoreId, updatePostgresInterview } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

const statuses: InterviewStatus[] = ["scheduled", "completed", "cancelled", "no_show"];

export const PATCH = withApiErrorHandling(async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const status = statuses.includes(body?.status) ? body.status : undefined;
  if (getStorageRuntime() === "postgres") {
    const storeId = await getPostgresInterviewStoreId(params.id);
    if (!storeId) return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    await requireStoreAccess(storeId, "interviews.update");
    const interview = await updatePostgresInterview({
      interviewId: params.id,
      actorUserId: (await getSessionContext()).userId,
      status,
      notes: typeof body?.notes === "string" ? body.notes : undefined,
    });
    if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    return NextResponse.json({ interview });
  }

  const interview = getApplicantStore().updateInterview({
    interviewId: params.id,
    status,
    notes: typeof body?.notes === "string" ? body.notes : undefined,
  });
  if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  return NextResponse.json({ interview });
});

export const DELETE = withApiErrorHandling(async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (getStorageRuntime() === "postgres") {
    const storeId = await getPostgresInterviewStoreId(params.id);
    if (!storeId) return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    await requireStoreAccess(storeId, "interviews.delete");
    const interview = await updatePostgresInterview({
      interviewId: params.id,
      actorUserId: (await getSessionContext()).userId,
      status: "cancelled",
      notes: "Interview cancelled by store",
    });
    if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    return NextResponse.json({ interview, deleted: false });
  }

  const interview = getApplicantStore().updateInterview({
    interviewId: params.id,
    status: "cancelled",
    notes: "Interview cancelled by store",
  });
  if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  return NextResponse.json({ interview, deleted: false });
});
