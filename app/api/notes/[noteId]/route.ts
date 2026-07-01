import { NextResponse } from "next/server";
import { getSessionContext, requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { deletePostgresApplicantNote, getPostgresApplicantNote } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export const DELETE = withApiErrorHandling(async function DELETE(_request: Request, props: { params: Promise<{ noteId: string }> }) {
  const params = await props.params;
  if (getStorageRuntime() === "postgres") {
    const existing = await getPostgresApplicantNote(params.noteId);
    if (!existing) return NextResponse.json({ error: "Note not found" }, { status: 404 });
    await requireStoreAccess(existing.storeId, "applicant_notes.delete");
    const note = await deletePostgresApplicantNote({
      noteId: params.noteId,
      actorUserId: (await getSessionContext()).userId,
    });
    if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });
    return NextResponse.json({ note });
  }

  const note = getApplicantStore().deleteApplicantNote(params.noteId);
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  return NextResponse.json({ note });
});
