import { NextResponse } from "next/server";
import { getSessionContext, requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { requireLocationInScope } from "@/lib/server/location-scope";
import { deletePostgresApplicantNote, getPostgresApplicantNote, getPostgresApplicationDetail } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export const DELETE = withApiErrorHandling(async function DELETE(_request: Request, props: { params: Promise<{ noteId: string }> }) {
  const params = await props.params;
  if (getStorageRuntime() === "postgres") {
    const existing = await getPostgresApplicantNote(params.noteId);
    if (!existing) return NextResponse.json({ error: "Note not found" }, { status: 404 });
    const access = await requireLocationScopedStoreAccess(existing.storeId, "applicant_notes.delete");
    const detail = await getPostgresApplicationDetail({ applicationId: existing.applicationId, storeId: existing.storeId });
    requireLocationInScope(detail?.job?.location || detail?.profile?.location, access.locationIds, "applicant_notes.delete");
    const note = await deletePostgresApplicantNote({
      noteId: params.noteId,
      actorUserId: (await getSessionContext()).userId,
    });
    if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });
    return NextResponse.json({ note });
  }

  const existing = getApplicantStore().getApplicantNote(params.noteId);
  if (!existing) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  const access = await requireLocationScopedStoreAccess(existing.storeId, "applicant_notes.delete");
  const detail = await getApplicantStore().getStoreApplicationDetail({ applicationId: existing.applicationId, storeId: existing.storeId });
  requireLocationInScope(detail?.job?.location || detail?.profile?.location, access.locationIds, "applicant_notes.delete");
  const note = getApplicantStore().deleteApplicantNote(params.noteId);
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  return NextResponse.json({ note });
});
