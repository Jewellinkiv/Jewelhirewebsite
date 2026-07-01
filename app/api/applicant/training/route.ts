import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { listPostgresApplicantTraining } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(request: Request) {
  const url = new URL(request.url);
  if (getStorageRuntime() === "postgres") {
    const items = await listPostgresApplicantTraining(url.searchParams.get("email"));
    return NextResponse.json({ count: items.length, items });
  }

  const items = getApplicantStore().listApplicantTraining(url.searchParams.get("email"));
  return NextResponse.json({ count: items.length, items });
});
