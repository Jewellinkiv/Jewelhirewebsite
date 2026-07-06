import { NextResponse } from "next/server";
import { getInterviewRsvpScope } from "@/lib/local-api-store";
import { requireRecipientOrStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresInterviewRsvpScope, updatePostgresInterviewRsvp } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

const RESPONSES = new Set(["accepted", "declined", "tentative"]);

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const response = body?.response;
  if (!RESPONSES.has(response)) {
    return NextResponse.json({ error: "response must be accepted, declined, or tentative" }, { status: 400 });
  }

  if (getStorageRuntime() === "postgres") {
    const scope = await getPostgresInterviewRsvpScope(params.id);
    if (!scope) return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    await requireRecipientOrStoreAccess({ ...scope, operation: "interviews.rsvp" });
    const interview = await updatePostgresInterviewRsvp({ interviewId: params.id, response });
    if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    return NextResponse.json({ interview });
  }

  const scope = getInterviewRsvpScope(params.id);
  if (!scope) return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  await requireRecipientOrStoreAccess({ ...scope, operation: "interviews.rsvp" });
  const interview = getApplicantStore().updateInterviewRsvp(params.id, response);
  if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  return NextResponse.json({ interview });
});
