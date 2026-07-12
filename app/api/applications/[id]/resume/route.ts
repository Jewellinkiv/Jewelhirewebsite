import { NextResponse } from "next/server";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import {
  getPostgresApplicationDetail,
  getPostgresApplicationResumeAttachment,
  getPostgresApplicationStoreId,
} from "@/lib/server/postgres-phase1";
import { requireLocationInScope } from "@/lib/server/location-scope";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function contentDisposition(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "resume";
  const encoded = encodeURIComponent(filename).replace(/['()]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  if (getStorageRuntime() !== "postgres") {
    return NextResponse.json({ error: { code: "not_found", message: "Résumé not found." } }, { status: 404 });
  }
  const params = await props.params;
  const storeId = await getPostgresApplicationStoreId(params.id);
  if (!storeId) return NextResponse.json({ error: { code: "not_found", message: "Résumé not found." } }, { status: 404 });

  const access = await requireLocationScopedStoreAccess(storeId, "applications.detail");
  const detail = await getPostgresApplicationDetail({ applicationId: params.id, storeId: access.storeId });
  if (!detail) return NextResponse.json({ error: { code: "not_found", message: "Résumé not found." } }, { status: 404 });
  requireLocationInScope(detail.job?.location || detail.profile.location, access.locationIds, "applications.detail");

  const attachment = await getPostgresApplicationResumeAttachment({ applicationId: params.id, storeId: access.storeId });
  if (!attachment) return NextResponse.json({ error: { code: "not_found", message: "Résumé not found." } }, { status: 404 });

  return new Response(new Uint8Array(attachment.content), {
    status: 200,
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(attachment.fileSizeBytes),
      "Content-Disposition": contentDisposition(attachment.originalFilename),
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
