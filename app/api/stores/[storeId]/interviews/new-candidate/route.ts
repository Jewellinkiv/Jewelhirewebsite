import { NextResponse } from "next/server";
import { getSessionContext, requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { createPostgresNewCandidateInterview } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { notifyInterviewScheduled } from "@/lib/server/notifications";
import { scheduleInterviewCalendar } from "@/lib/server/calendar";

const locationTypes = new Set(["in_store", "phone", "video"]);

export const dynamic = "force-dynamic";

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const storeId = await requireStoreAccess(params.storeId, "interviews.create");
  if (getStorageRuntime() === "postgres") {
    const result = await createPostgresNewCandidateInterview({
      storeId,
      actorUserId: (await getSessionContext()).userId,
      name: body?.name,
      email: body?.email,
      phone: body?.phone,
      role: body?.role,
      jobId: body?.jobId,
      candidateLocation: body?.candidateLocation || body?.location,
      headline: body?.headline,
      summary: body?.summary,
      date: body?.date,
      time: body?.time,
      startsAt: body?.startsAt,
      duration: Number.isFinite(Number(body?.duration)) ? Number(body.duration) : undefined,
      type: locationTypes.has(body?.type) ? body.type : undefined,
      location: body?.interviewLocation || body?.locationDetails,
      interviewer: body?.interviewer,
      notes: body?.notes,
    });
    if (!result?.interview) {
      return NextResponse.json({ error: "Candidate name and valid email are required" }, { status: 400 });
    }
    const notification = await notifyInterviewScheduled({
      toEmail: body?.email,
      recipientName: body?.name,
      interviewId: result.interview.id,
      applicationId: result.interview.applicationId,
      storeId: result.interview.storeId,
      startsAt: result.interview.startsAt,
      locationDetails: result.interview.locationDetails,
    });
    const calendar = await scheduleInterviewCalendar({
      storeId: result.interview.storeId,
      interviewId: result.interview.id,
      startsAt: result.interview.startsAt,
      endsAt: (result.interview as { endsAt?: string }).endsAt,
      durationMinutes: Number.isFinite(Number(body?.duration)) ? Number(body.duration) : undefined,
      role: body?.role,
      candidateName: body?.name,
      candidateEmail: body?.email,
      locationDetails: result.interview.locationDetails,
    });
    return NextResponse.json({ ...result, notification, calendar }, { status: 201 });
  }

  const result = getApplicantStore().createNewCandidateInterview({
    storeId,
    name: body?.name,
    email: body?.email,
    phone: body?.phone,
    role: body?.role,
    jobId: body?.jobId,
    location: body?.candidateLocation || body?.location,
    headline: body?.headline,
    summary: body?.summary,
    date: body?.date,
    time: body?.time,
    startsAt: body?.startsAt,
    duration: Number.isFinite(Number(body?.duration)) ? Number(body.duration) : undefined,
    type: locationTypes.has(body?.type) ? body.type : undefined,
    interviewLocation: body?.interviewLocation || body?.locationDetails,
    interviewer: body?.interviewer,
    notes: body?.notes,
  });
  if (!result?.interview) {
    return NextResponse.json({ error: "Candidate name and valid email are required" }, { status: 400 });
  }
  const notification = await notifyInterviewScheduled({
    toEmail: body?.email,
    recipientName: body?.name,
    interviewId: result.interview.id,
    applicationId: result.interview.applicationId,
    storeId: result.interview.storeId,
    startsAt: result.interview.startsAt,
    locationDetails: result.interview.locationDetails,
  });
  return NextResponse.json({ ...result, notification }, { status: 201 });
});
