import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { listPostgresStoreJewelCertInvites } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const storeId = await requireStoreAccess(params.storeId, "jewelcert_invites.list");
  const allItems = await (
    getStorageRuntime() === "postgres"
      ? await listPostgresStoreJewelCertInvites(storeId)
      : getApplicantStore().listStoreJewelCertInvites(storeId)
  );
  const items = allItems
    .filter((item) => !status || item.status.toLowerCase() === status.toLowerCase());
  return NextResponse.json({ count: items.length, items });
});
