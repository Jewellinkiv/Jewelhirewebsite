import { NextResponse } from "next/server";
import { listPostgresApplicantApplications } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const items =
    getStorageRuntime() === "postgres"
      ? await listPostgresApplicantApplications(url.searchParams.get("email"))
      : getApplicantStore().listApplicantApplications(url.searchParams.get("email"));
  return NextResponse.json({ count: items.length, items });
}
