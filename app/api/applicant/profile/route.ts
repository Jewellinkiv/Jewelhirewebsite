import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresApplicantProfile, updatePostgresApplicantResume } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(request: Request) {
  const url = new URL(request.url);
  const profile =
    getStorageRuntime() === "postgres"
      ? await getPostgresApplicantProfile(url.searchParams.get("email"))
      : getApplicantStore().getApplicantProfile(url.searchParams.get("email"));
  if (!profile) return NextResponse.json({ error: "Applicant profile not found" }, { status: 404 });
  return NextResponse.json({ profile });
});

export const PATCH = withApiErrorHandling(async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (getStorageRuntime() === "postgres") {
    const result = await updatePostgresApplicantResume({
      lookupEmail: body?.lookupEmail || body?.email,
      email: body?.email,
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
    lookupEmail: body?.lookupEmail || body?.email,
    email: body?.email,
    fullName: body?.fullName || body?.name,
    phone: body?.phone,
    headline: body?.headline,
    location: body?.location,
    summary: body?.summary,
  });
  if (!result) return NextResponse.json({ error: "Applicant profile not found" }, { status: 404 });
  return NextResponse.json({ profile: result.profile });
});
