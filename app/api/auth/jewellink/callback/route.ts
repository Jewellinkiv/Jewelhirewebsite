import { NextResponse } from "next/server";
import { jewelLinkStateCookieName, jewelLinkStateCookieSecure, setSessionCookie } from "@/lib/server/auth";
import {
  exchangeJewelLinkCode,
  JewelLinkAccessRevokedError,
  JewelLinkAssuranceError,
  JewelLinkIdentityConflictError,
  provisionJewelLinkSession,
} from "@/lib/server/jewellink-sso";
import { jewelLinkStateMatches, validJewelLinkState } from "@/lib/server/jewellink-sso-contract";
import { safeSameOriginPath } from "@/lib/server/safe-redirect";

function appBaseUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
}

function clearState(response: NextResponse) {
  response.cookies.set(jewelLinkStateCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: jewelLinkStateCookieSecure(),
    path: "/",
    maxAge: 0,
  });
  return response;
}

function loginError(request: Request, error: string) {
  const url = new URL("/login", appBaseUrl(request));
  url.searchParams.set("error", error);
  return clearState(NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } }));
}

function cookieValue(request: Request, name: string) {
  const raw = request.headers.get("cookie") || "";
  const encoded = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!encoded) return undefined;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
}

function roleDestination(role: string) {
  if (role === "admin") return "/admin";
  if (role === "associate") return "/portal";
  return "/";
}

function safeDestination(returnTo: string | undefined, role: string) {
  const destination = safeSameOriginPath(returnTo);
  if (!destination) return roleDestination(role);
  if (role === "associate" && !destination.startsWith("/portal")) return "/portal";
  if (role === "admin" && !destination.startsWith("/admin")) return "/admin";
  if ((role === "store_owner" || role === "manager") && (destination.startsWith("/portal") || destination.startsWith("/admin"))) return "/";
  return destination;
}

export async function GET(request: Request) {
  const callbackUrl = new URL(request.url);
  const code = callbackUrl.searchParams.get("code")?.trim() || "";
  const state = callbackUrl.searchParams.get("state");
  const stateCookie = cookieValue(request, jewelLinkStateCookieName());
  if (!code || code.length > 256) return loginError(request, "jewellink_code");
  // Check the browser binding before exchanging (and consuming) the one-time
  // code. This makes cross-browser callbacks fail without burning a valid code.
  if (!validJewelLinkState(state) || !jewelLinkStateMatches({ urlState: state, cookieState: stateCookie, claimState: state })) {
    return loginError(request, "jewellink_state");
  }
  try {
    const claims = await exchangeJewelLinkCode(code);
    if (!jewelLinkStateMatches({ urlState: state, cookieState: stateCookie, claimState: claims.state })) {
      return loginError(request, "jewellink_state");
    }
    const session = await provisionJewelLinkSession(claims);
    if (!session) return loginError(request, "jewellink_access");
    const response = NextResponse.redirect(new URL(safeDestination(claims.returnTo, session.role), appBaseUrl(request)), {
      headers: { "Cache-Control": "no-store" },
    });
    setSessionCookie(response, session);
    return clearState(response);
  } catch (error) {
    if (error instanceof JewelLinkAssuranceError) return loginError(request, "jewellink_assurance");
    if (error instanceof JewelLinkIdentityConflictError) return loginError(request, "jewellink_identity");
    if (error instanceof JewelLinkAccessRevokedError) return loginError(request, "jewellink_access");
    return loginError(request, "jewellink_exchange");
  }
}
