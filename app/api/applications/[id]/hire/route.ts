import { NextResponse } from "next/server";
import { getSessionContext, requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresApplicationStoreId, getPostgresHirePreview, hirePostgresApplication } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  if (getStorageRuntime() === "postgres") {
    const storeId = await getPostgresApplicationStoreId(params.id);
    if (!storeId) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    await requireStoreAccess(storeId, "hire.confirm");
    const sync = await hirePostgresApplication({
      applicationId: params.id,
      storeId,
      actorUserId: (await getSessionContext()).userId,
      role: body?.role,
      locationId: body?.locationId,
    });
    if (!sync) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    return NextResponse.json({
      hireSync: sync,
      preview: await getPostgresHirePreview({
        applicationId: params.id,
        storeId,
        role: body?.role,
        locationId: body?.locationId,
      }),
    });
  }

  const store = getApplicantStore();
  const sync = store.hireApplication({
    applicationId: params.id,
    role: body?.role,
    locationId: body?.locationId,
  });

  if (!sync) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  return NextResponse.json({
    hireSync: sync,
    preview: store.getHirePreview({
      applicationId: params.id,
      role: body?.role,
      locationId: body?.locationId,
    }),
  });
});
