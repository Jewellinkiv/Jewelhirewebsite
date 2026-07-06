import { NextResponse } from "next/server";
import { RESUME_TEMPLATES } from "@/lib/resume-templates";
import { requireApplicantSelf } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresApplicantResume } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export const dynamic = "force-dynamic";

export const POST = withApiErrorHandling(async function POST(request: Request) {
  const { email } = await requireApplicantSelf("applicant.resume.export");
  const body = await request.json().catch(() => null);
  const templateId = body?.templateId || "classic";
  const template = RESUME_TEMPLATES.find((item) => item.id === templateId) || RESUME_TEMPLATES[0];
  const resume =
    getStorageRuntime() === "postgres"
      ? await getPostgresApplicantResume(email)
      : getApplicantStore().getApplicantResume(email);
  if (!resume) return NextResponse.json({ error: "Applicant resume not found" }, { status: 404 });

  const exportId = `resume-export-${Date.now().toString(36)}`;
  return NextResponse.json({
    exportId,
    status: "ready",
    format: "pdf",
    strategy: "browser_print_until_pdf_service",
    filename: `${resume.profile.fullName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "resume"}.pdf`,
    template,
    resume,
  });
});
