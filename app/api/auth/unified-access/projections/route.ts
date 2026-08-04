import { NextRequest, NextResponse } from "next/server";
import { applyJewelHireLinkdProjection } from "@/lib/server/linkd-unified-projection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const advertised = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(advertised) && advertised > 128 * 1024) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: { "cache-control": "no-store" } });
  }
  const applied = await applyJewelHireLinkdProjection({
    body: await request.text(),
    timestamp: request.headers.get("x-linkd-access-timestamp"),
    signature: request.headers.get("x-linkd-access-signature"),
  });
  if (!applied) return NextResponse.json({ error: "Not found." }, { status: 404, headers: { "cache-control": "no-store" } });
  return NextResponse.json({ data: { ...applied, status: "applied" } }, { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
