import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { listApplicationJewelCertResults } from "@/lib/local-assessment-store";
import {
  getPostgresApplicationStoreId,
  listPostgresApplicationJewelCertResults,
} from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;

  if (getStorageRuntime() === "postgres") {
    const storeId = await getPostgresApplicationStoreId(params.id);
    if (!storeId) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    await requireStoreAccess(storeId, "jewelcert.list");
    const items = await listPostgresApplicationJewelCertResults(params.id);
    return NextResponse.json({ applicationId: params.id, count: items.length, items });
  }

  const items = listApplicationJewelCertResults(params.id);
  return NextResponse.json({ applicationId: params.id, count: items.length, items });
});
