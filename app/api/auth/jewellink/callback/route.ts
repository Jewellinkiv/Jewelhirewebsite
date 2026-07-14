import { NextResponse } from "next/server";
import { jewelLinkStateCookieName, jewelLinkStateCookieSecure, SESSION_COOKIE, setSessionCookie } from "@/lib/server/auth";
import {
  exchangeJewelLinkCode,
  JewelLinkAccessRevokedError,
  JewelLinkAssuranceError,
  JewelLinkIdentityConflictError,
  provisionJewelLinkSession,
} from "@/lib/server/jewellink-sso";
import {
  jewelLinkSessionDestination,
  jewelLinkStateMatches,
  validJewelLinkState,
} from "@/lib/server/jewellink-sso-contract";

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

function loginError(request: Request, error: string, clearCurrentSession = false) {
  const url = new URL("/login", appBaseUrl(request));
  url.searchParams.set("error", error);
  const response = clearState(NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } }));
  if (clearCurrentSession) response.cookies.delete(SESSION_COOKIE);
  return response;
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
  let clearCurrentSessionOnFailure = false;
  try {
    const claims = await exchangeJewelLinkCode(code);
    if (!jewelLinkStateMatches({ urlState: state, cookieState: stateCookie, claimState: claims.state })) {
      return loginError(request, "jewellink_state");
    }
    // Only a successfully exchanged code whose claims are bound to this browser
    // may clear an older JewelHire session. Invalid or cross-browser callbacks
    // must not become logout CSRF primitives.
    clearCurrentSessionOnFailure = true;
    const session = await provisionJewelLinkSession(claims);
    if (!session) return loginError(request, "jewellink_access", true);
    const response = NextResponse.redirect(new URL(jewelLinkSessionDestination(claims.returnTo, session.role), appBaseUrl(request)), {
      headers: { "Cache-Control": "no-store" },
    });
    setSessionCookie(response, session);
    return clearState(response);
  } catch (error) {
    if (error instanceof JewelLinkAssuranceError) return loginError(request, "jewellink_assurance", clearCurrentSessionOnFailure);
    if (error instanceof JewelLinkIdentityConflictError) return loginError(request, "jewellink_identity", clearCurrentSessionOnFailure);
    if (error instanceof JewelLinkAccessRevokedError) return loginError(request, "jewellink_access", clearCurrentSessionOnFailure);
    return loginError(request, "jewellink_exchange", clearCurrentSessionOnFailure);
  }
}
