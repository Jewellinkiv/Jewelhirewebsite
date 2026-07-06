import { NextResponse } from "next/server";
import { DEFAULT_STORE_ID } from "@/lib/applicant-lifecycle";
import { requireAdminAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresPublicStoreSnapshot, listPostgresApplicationSummaries } from "@/lib/server/postgres-phase1";
import { checkPostgresReadiness } from "@/lib/server/postgres-readiness";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(request: Request) {
  await requireAdminAccess("admin.database.snapshot.read");
  const readiness = await checkPostgresReadiness();
  if (!readiness.ok) {
    return NextResponse.json(
      {
        ok: false,
        status: readiness.status,
        readiness,
        snapshot: null,
      },
      { status: readiness.configured ? 503 : 200 },
    );
  }

  const url = new URL(request.url);
  const storeSlug = url.searchParams.get("storeSlug") || "sissys-log-cabin-careers";
  const storeId = url.searchParams.get("storeId") || DEFAULT_STORE_ID;
  const q = url.searchParams.get("q") || "";
  const snapshot = await getPostgresPublicStoreSnapshot(storeSlug);
  const applications = await listPostgresApplicationSummaries({ storeId, query: q, limit: 10 });

  return NextResponse.json({
    ok: true,
    status: "ready",
    storeSlug,
    storeId,
    snapshot,
    applications,
  });
});
