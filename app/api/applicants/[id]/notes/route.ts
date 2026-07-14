import { NextResponse } from "next/server";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { requireLocationInScope } from "@/lib/server/location-scope";
import {
  addPostgresApplicantNote,
  getPostgresApplicationDetail,
  listPostgresApplicantNotes,
  resolvePostgresApplicantApplication,
} from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

const noteTypes = new Set(["general", "screening", "interview", "hire_handoff"]);

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (getStorageRuntime() === "postgres") {
    const scope = await resolvePostgresApplicantApplication(params.id);
    if (!scope) return NextResponse.json({ items: [] });
    const access = await requireLocationScopedStoreAccess(scope.storeId, "applicant_notes.list");
    const detail = await getPostgresApplicationDetail(scope);
    requireLocationInScope(detail?.job?.location || detail?.profile?.location, access.locationIds, "applicant_notes.list");
    return NextResponse.json({ items: await listPostgresApplicantNotes(scope.applicationId) });
  }

  const detail = await getApplicantStore().getStoreApplicantDetail(params.id);
  if (!detail) return NextResponse.json({ items: [] });
  const access = await requireLocationScopedStoreAccess(detail.application.storeId, "applicant_notes.list");
  requireLocationInScope(detail.job?.location || detail.profile.location, access.locationIds, "applicant_notes.list");
  return NextResponse.json({ items: getApplicantStore().listApplicantNotes(params.id) });
});

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const text = body?.text || body?.body;
  if (!text?.trim()) return NextResponse.json({ error: "Note text is required" }, { status: 400 });
  const noteType = noteTypes.has(body?.noteType) ? body.noteType : "general";

  if (getStorageRuntime() === "postgres") {
    const scope = await resolvePostgresApplicantApplication(params.id);
    if (!scope) return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
    const access = await requireLocationScopedStoreAccess(scope.storeId, "applicant_notes.create");
    const detail = await getPostgresApplicationDetail(scope);
    requireLocationInScope(detail?.job?.location || detail?.profile?.location, access.locationIds, "applicant_notes.create");
    const note = await addPostgresApplicantNote({
      applicationId: scope.applicationId,
      storeId: scope.storeId,
      body: text,
      noteType,
      actorUserId: access.session.userId,
    });
    if (!note) return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
    return NextResponse.json({ note }, { status: 201 });
  }

  const detail = await getApplicantStore().getStoreApplicantDetail(params.id);
  if (!detail) return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
  const access = await requireLocationScopedStoreAccess(detail.application.storeId, "applicant_notes.create");
  requireLocationInScope(detail.job?.location || detail.profile.location, access.locationIds, "applicant_notes.create");
  const note = getApplicantStore().addApplicantNote({ applicantId: params.id, body: text, noteType });
  if (!note) return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
  return NextResponse.json({ note }, { status: 201 });
});
