import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import {
  getJewelLinkIntegrationConfiguration,
  getPostgresJewelCertResultSyncStoreId,
  listPostgresJewelLinkIntegrationIssues,
  syncPostgresHireToJewelLink,
  syncPostgresJewelCertResultToJewelLink,
} from "@/lib/server/jewellink-integration";
import { getPostgresApplicationStoreId } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export const GET = withApiErrorHandling(async function GET(
  _request: Request,
  props: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await props.params;
  await requireStoreAccess(storeId, "integrations.jewellink.health");
  const configuration = getJewelLinkIntegrationConfiguration();
  const issues = getStorageRuntime() === "postgres"
    ? await listPostgresJewelLinkIntegrationIssues(storeId)
    : [];
  return NextResponse.json({
    storeId,
    runtime: getStorageRuntime(),
    configuration,
    issueCount: issues.length,
    issues,
  }, { headers: { "Cache-Control": "no-store" } });
});

export const POST = withApiErrorHandling(async function POST(
  request: Request,
  props: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await props.params;
  await requireStoreAccess(storeId, "integrations.jewellink.retry");
  if (getStorageRuntime() !== "postgres") {
    return NextResponse.json({ error: "JewelLink retry requires the PostgreSQL runtime" }, { status: 501 });
  }
  const body = await request.json().catch(() => null);
  const kind = body?.kind === "hire" || body?.kind === "jewelcert_result" ? body.kind : "";
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!kind || !id) return NextResponse.json({ error: "A valid integration issue kind and id are required" }, { status: 400 });

  if (kind === "hire") {
    const issueStoreId = await getPostgresApplicationStoreId(id);
    if (issueStoreId !== storeId) return NextResponse.json({ error: "Hire synchronization not found" }, { status: 404 });
    const sync = await syncPostgresHireToJewelLink(id);
    if (!sync) return NextResponse.json({ error: "Hire synchronization not found" }, { status: 404 });
    return NextResponse.json({ kind, id, status: sync.syncStatus, sync }, { status: sync.syncStatus === "synced" ? 200 : 502 });
  }

  const issueStoreId = await getPostgresJewelCertResultSyncStoreId(id);
  if (issueStoreId !== storeId) return NextResponse.json({ error: "JewelCert result synchronization not found" }, { status: 404 });
  const result = await syncPostgresJewelCertResultToJewelLink(id);
  return NextResponse.json({ kind, id, ...result }, { status: result.status === "synced" ? 200 : 502 });
});
