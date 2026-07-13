import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/server/auth";
import { exchangeJewelLinkCode, provisionJewelLinkSession } from "@/lib/server/jewellink-sso";

function appBaseUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
}

function loginError(request: Request, error: string) {
  const url = new URL("/login", appBaseUrl(request));
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
}

function roleDestination(role: string) {
  if (role === "admin") return "/admin";
  if (role === "associate") return "/portal";
  return "/";
}

function safeDestination(returnTo: string | undefined, role: string) {
  if (!returnTo) return roleDestination(role);
  if (role === "associate" && !returnTo.startsWith("/portal")) return "/portal";
  if (role === "admin" && !returnTo.startsWith("/admin")) return "/admin";
  if ((role === "store_owner" || role === "manager") && (returnTo.startsWith("/portal") || returnTo.startsWith("/admin"))) return "/";
  return returnTo;
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")?.trim() || "";
  if (!code || code.length > 256) return loginError(request, "jewellink_code");
  try {
    const claims = await exchangeJewelLinkCode(code);
    const session = await provisionJewelLinkSession(claims);
    if (!session) return loginError(request, "jewellink_access");
    const response = NextResponse.redirect(new URL(safeDestination(claims.returnTo, session.role), appBaseUrl(request)), {
      headers: { "Cache-Control": "no-store" },
    });
    setSessionCookie(response, session);
    return response;
  } catch {
    return loginError(request, "jewellink_exchange");
  }
}
