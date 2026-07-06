import { NextResponse } from "next/server";
import { requireApplicantSelf } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresApplicantProfile, updatePostgresApplicantResume } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET() {
  const { email } = await requireApplicantSelf("applicant.profile.read");
  const profile =
    getStorageRuntime() === "postgres"
      ? await getPostgresApplicantProfile(email)
      : getApplicantStore().getApplicantProfile(email);
  if (!profile) return NextResponse.json({ error: "Applicant profile not found" }, { status: 404 });
  return NextResponse.json({ profile });
});

export const PATCH = withApiErrorHandling(async function PATCH(request: Request) {
  const { email } = await requireApplicantSelf("applicant.profile.update");
  const body = await request.json().catch(() => null);
  if (getStorageRuntime() === "postgres") {
    const result = await updatePostgresApplicantResume({
      lookupEmail: email,
      fullName: body?.fullName || body?.name,
      phone: body?.phone,
      headline: body?.headline,
      location: body?.location,
      summary: body?.summary,
    });
    if (!result) return NextResponse.json({ error: "Applicant profile not found" }, { status: 404 });
    return NextResponse.json({ profile: result.profile });
  }

  const result = getApplicantStore().updateApplicantResume({
    lookupEmail: email,
    fullName: body?.fullName || body?.name,
    phone: body?.phone,
    headline: body?.headline,
    location: body?.location,
    summary: body?.summary,
  });
  if (!result) return NextResponse.json({ error: "Applicant profile not found" }, { status: 404 });
  return NextResponse.json({ profile: result.profile });
});
