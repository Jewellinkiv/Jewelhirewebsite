import { NextResponse } from "next/server";
import { SESSION_COOKIE, setSessionCookie } from "@/lib/server/auth";
import { exchangeLinkdUnifiedCode } from "@/lib/server/linkd-unified-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appBaseUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
}

function denied(request: Request, clearSession = false) {
  const url = new URL("/login", appBaseUrl(request));
  url.searchParams.set("error", "permission_denied");
  const response = NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
  if (clearSession) response.cookies.delete(SESSION_COOKIE);
  return response;
}

export async function GET(request: Request) {
  const session = await exchangeLinkdUnifiedCode(request);
  if (!session) return denied(request);
  const destination = session.role === "associate" ? "/portal" : "/";
  const response = NextResponse.redirect(new URL(destination, appBaseUrl(request)), { headers: { "Cache-Control": "no-store" } });
  setSessionCookie(response, session);
  return response;
}
