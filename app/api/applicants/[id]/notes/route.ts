import { NextResponse } from "next/server";
import { getSessionContext, requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import {
  addPostgresApplicantNote,
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
    await requireStoreAccess(scope.storeId, "applicant_notes.list");
    return NextResponse.json({ items: await listPostgresApplicantNotes(scope.applicationId) });
  }

  return NextResponse.json({ items: getApplicantStore().listScopedApplicantNotes(params.id) });
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
    await requireStoreAccess(scope.storeId, "applicant_notes.create");
    const note = await addPostgresApplicantNote({
      applicationId: scope.applicationId,
      storeId: scope.storeId,
      body: text,
      noteType,
      actorUserId: (await getSessionContext()).userId,
    });
    if (!note) return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
    return NextResponse.json({ note }, { status: 201 });
  }

  const note = getApplicantStore().addScopedApplicantNote({ applicantId: params.id, body: text, noteType });
  if (!note) return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
  return NextResponse.json({ note }, { status: 201 });
});
