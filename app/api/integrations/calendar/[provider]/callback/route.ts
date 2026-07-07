import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { completeConnection, type CalendarProvider } from "@/lib/server/calendar";
import { verifyState } from "@/lib/server/calendar/oauth-state";

export const runtime = "nodejs";

function appBaseUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
}

function isProvider(value: string): value is CalendarProvider {
  return value === "google" || value === "microsoft";
}

function backToSettings(request: Request, params: Record<string, string>) {
  const url = new URL("/settings", appBaseUrl(request));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

// OAuth redirect target. Verifies the signed state, re-checks store access, then
// exchanges the code and persists the connection.
export async function GET(request: Request, props: { params: Promise<{ provider: string }> }) {
  const { provider } = await props.params;
  if (!isProvider(provider)) return backToSettings(request, { calendar: "error" });

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const oauthError = url.searchParams.get("error");
  if (oauthError) return backToSettings(request, { calendar: "denied" });

  const parsed = verifyState(state);
  if (!code || !parsed || parsed.provider !== provider) {
    return backToSettings(request, { calendar: "error" });
  }
  try {
    await requireStoreAccess(parsed.storeId, "calendar.connect");
  } catch {
    return backToSettings(request, { calendar: "forbidden" });
  }

  try {
    const redirectUri = `${appBaseUrl(request)}/api/integrations/calendar/${provider}/callback`;
    await completeConnection(provider, code, redirectUri, parsed.storeId);
  } catch {
    return backToSettings(request, { calendar: "error" });
  }
  return backToSettings(request, { calendar: "connected", provider });
}
