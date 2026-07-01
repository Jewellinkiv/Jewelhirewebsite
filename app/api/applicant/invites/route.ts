import { NextResponse } from "next/server";
import { listPostgresApplicantInvites } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const items =
    getStorageRuntime() === "postgres"
      ? await listPostgresApplicantInvites(url.searchParams.get("email"), status)
      : getApplicantStore().listApplicantInvites(url.searchParams.get("email")).filter((invite) => !status || invite.status === status);
  return NextResponse.json({ count: items.length, items });
}
