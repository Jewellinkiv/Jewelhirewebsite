import { NextResponse } from "next/server";
import {
  linkdCapabilityPublication,
  linkdManifestPublicationSecretMatches,
} from "@/lib/server/linkd-unified-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!linkdManifestPublicationSecretMatches(request.headers.get("x-linkd-access-manifest-secret"))) {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const publication = linkdCapabilityPublication();
  if (!publication) return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    const response = await fetch(new URL("/api/unified-access/capabilities", publication.config.authority), {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        clientId: publication.config.clientId,
        clientSecret: publication.config.clientSecret,
        manifest: publication.manifest,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    return new NextResponse(null, { status: response.ok ? 204 : 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    return new NextResponse(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
