import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresApplicantResume, updatePostgresApplicantResume } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(request: Request) {
  const url = new URL(request.url);
  if (getStorageRuntime() === "postgres") {
    const resume = await getPostgresApplicantResume(url.searchParams.get("email"));
    if (!resume) return NextResponse.json({ error: "Applicant resume not found" }, { status: 404 });
    return NextResponse.json(resume);
  }

  const resume = getApplicantStore().getApplicantResume(url.searchParams.get("email"));
  if (!resume) return NextResponse.json({ error: "Applicant resume not found" }, { status: 404 });
  return NextResponse.json(resume);
});

export const PUT = withApiErrorHandling(async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (getStorageRuntime() === "postgres") {
    const resume = await updatePostgresApplicantResume({
      lookupEmail: body?.lookupEmail,
      email: body?.email,
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
    lookupEmail: body?.lookupEmail,
    email: body?.email,
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
