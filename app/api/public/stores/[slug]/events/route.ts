import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { recordPostgresPublicCareersEvent } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

const MAX_EVENT_BYTES = 2 * 1024;

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ slug: string }> }) {
  const limited = await enforceRateLimit(request, "public-careers-event", { limit: 120, windowSeconds: 3_600 });
  if (limited) return limited;
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: { code: "unsupported_media_type", message: "Event data must be sent as JSON." } }, { status: 415 });
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_EVENT_BYTES) {
    return NextResponse.json({ error: { code: "payload_too_large", message: "Event data is too large." } }, { status: 413 });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_EVENT_BYTES) {
    return NextResponse.json({ error: { code: "payload_too_large", message: "Event data is too large." } }, { status: 413 });
  }
  const body = (() => { try { return JSON.parse(raw); } catch { return null; } })();
  if (!body || (body.event !== "page_view" && body.event !== "application_start")) {
    return NextResponse.json({ error: { code: "invalid_event", message: "Event data could not be read." } }, { status: 400 });
  }
  const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
  if (body.event === "application_start" && (!jobId || jobId.length > 160 || !/^[a-zA-Z0-9_-]+$/.test(jobId))) {
    return NextResponse.json({ error: { code: "invalid_job", message: "Event data could not be read." } }, { status: 400 });
  }
  if (getStorageRuntime() === "postgres") {
    const params = await props.params;
    await recordPostgresPublicCareersEvent({ storeSlug: params.slug, eventType: body.event, jobId });
  }
  return new NextResponse(null, { status: 202, headers: { "Cache-Control": "no-store" } });
});
