import { NextResponse } from "next/server";
import { requireApplicantSelf } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresApplicantResume, updatePostgresApplicantResume } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET() {
  const { email } = await requireApplicantSelf("applicant.resume.read");
  if (getStorageRuntime() === "postgres") {
    const resume = await getPostgresApplicantResume(email);
    if (!resume) return NextResponse.json({ error: "Applicant resume not found" }, { status: 404 });
    return NextResponse.json(resume);
  }

  const resume = getApplicantStore().getApplicantResume(email);
  if (!resume) return NextResponse.json({ error: "Applicant resume not found" }, { status: 404 });
  return NextResponse.json(resume);
});

export const PUT = withApiErrorHandling(async function PUT(request: Request) {
  const { email } = await requireApplicantSelf("applicant.resume.update");
  const body = await request.json().catch(() => null);
  if (getStorageRuntime() === "postgres") {
    const resume = await updatePostgresApplicantResume({
      lookupEmail: email,
      fullName: body?.fullName,
      phone: body?.phone,
      headline: body?.headline,
      location: body?.location,
      summary: body?.summary,
      workExperience: Array.isArray(body?.workExperience) ? body.workExperience : undefined,
      education: Array.isArray(body?.education) ? body.education : undefined,
      skills: Array.isArray(body?.skills) ? body.skills : undefined,
      portfolioLinks: Array.isArray(body?.portfolioLinks) ? body.portfolioLinks : undefined,
      templateId: body?.templateId,
    });
    if (!resume) return NextResponse.json({ error: "Applicant resume not found" }, { status: 404 });
    return NextResponse.json(resume);
  }

  const resume = getApplicantStore().updateApplicantResume({
    lookupEmail: email,
    fullName: body?.fullName,
    phone: body?.phone,
    headline: body?.headline,
    location: body?.location,
    summary: body?.summary,
    workExperience: body?.workExperience,
    education: body?.education,
    skills: body?.skills,
    portfolioLinks: body?.portfolioLinks,
    templateId: body?.templateId,
  });

  if (!resume) return NextResponse.json({ error: "Applicant resume not found" }, { status: 404 });
  return NextResponse.json(resume);
});
