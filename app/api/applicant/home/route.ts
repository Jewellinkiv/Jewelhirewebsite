import { NextResponse } from "next/server";
import { getPostgresApplicantHome } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (getStorageRuntime() === "postgres") {
    return NextResponse.json(await getPostgresApplicantHome(url.searchParams.get("email")));
  }
  return NextResponse.json(getApplicantStore().getApplicantHome(url.searchParams.get("email")));
}
