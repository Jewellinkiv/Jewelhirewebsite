import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { listPostgresStoreGemMatchInvites } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const url = new URL(request.url);
  const items = await (
    getStorageRuntime() === "postgres"
      ? await listPostgresStoreGemMatchInvites(await requireStoreAccess(params.storeId, "gemmatch_invites.list"), url.searchParams.get("status"))
      : getApplicantStore().listStoreGemMatchInvites(params.storeId, url.searchParams.get("status"))
  );
  return NextResponse.json({ count: items.length, items });
});
