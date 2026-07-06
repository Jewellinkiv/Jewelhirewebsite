import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { buildAuthUrl, providerConfigured, type CalendarProvider } from "@/lib/server/calendar";
import { signState } from "@/lib/server/calendar/oauth-state";

export const runtime = "nodejs";

function appBaseUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
}

function isProvider(value: string): value is CalendarProvider {
  return value === "google" || value === "microsoft";
}

// Store owner initiates a calendar connection. Requires store access; redirects
// to the provider consent screen with a signed state carrying the storeId.
export async function GET(request: Request, props: { params: Promise<{ provider: string }> }) {
  const { provider } = await props.params;
  if (!isProvider(provider)) {
    return NextResponse.json({ error: { code: "bad_provider", message: "Unknown calendar provider." } }, { status: 404 });
  }
  const storeId = new URL(request.url).searchParams.get("storeId") || "";
  try {
    await requireStoreAccess(storeId, "calendar.connect");
  } catch {
    return NextResponse.json({ error: { code: "forbidden", message: "You don't have access to this store." } }, { status: 403 });
  }
  if (!providerConfigured(provider)) {
    return NextResponse.json(
      { error: { code: "provider_not_configured", message: `${provider} calendar is not configured on the server.` } },
      { status: 503 },
    );
  }

  const redirectUri = `${appBaseUrl(request)}/api/integrations/calendar/${provider}/callback`;
  const state = signState({ storeId, provider, nonce: randomBytes(12).toString("base64url") });
  return NextResponse.redirect(buildAuthUrl(provider, redirectUri, state));
}
