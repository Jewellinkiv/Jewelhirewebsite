import { NextResponse } from "next/server";
import { RESUME_TEMPLATES } from "@/lib/resume-templates";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { updatePostgresApplicantResume } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export const dynamic = "force-dynamic";

export const PUT = withApiErrorHandling(async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const templateId = body?.templateId;
  if (!RESUME_TEMPLATES.some((template) => template.id === templateId)) {
    return NextResponse.json({ error: "Valid templateId is required" }, { status: 400 });
  }

  const lookupEmail = body?.lookupEmail || body?.email;
  const result =
    getStorageRuntime() === "postgres"
      ? await updatePostgresApplicantResume({ lookupEmail, email: body?.email, templateId })
      : getApplicantStore().updateApplicantResume({ lookupEmail, email: body?.email, templateId });
  if (!result) return NextResponse.json({ error: "Applicant resume not found" }, { status: 404 });
  return NextResponse.json({ ...result, templateId });
});
