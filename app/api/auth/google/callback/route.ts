import { NextResponse } from "next/server";
import {
  findSessionForGoogleUser,
  isJewelLinkSsoOnlyEmail,
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  setSessionCookie,
} from "@/lib/server/auth";
import type { AuthSession } from "@/lib/server/auth";
import { safeSameOriginPathOrRoot } from "@/lib/server/safe-redirect";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleProfile = {
  email?: string;
  email_verified?: boolean;
  name?: string;
};

function appBaseUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
}

function redirectToLogin(request: Request, error: string) {
  const login = new URL("/login", appBaseUrl(request));
  login.searchParams.set("error", error);
  return NextResponse.redirect(login);
}

function cookieValue(request: Request, name: string) {
  const raw = request.headers.get("cookie") || "";
  const encoded = raw
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  if (!encoded) return undefined;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
}

function destinationForSession(next: string, session: AuthSession) {
  const safe = safeSameOriginPathOrRoot(next);
  if (safe !== "/") return safe;
  if (session.role === "admin") return "/admin";
  if (session.role === "associate") return "/portal";
  return "/";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = cookieValue(request, OAUTH_STATE_COOKIE);
  const nextCookie = cookieValue(request, OAUTH_NEXT_COOKIE) || "/";
  if (!code || !state || !stateCookie || state !== stateCookie) return redirectToLogin(request, "state");
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return redirectToLogin(request, "config");

  const redirectUri = `${appBaseUrl(request)}/api/auth/google/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const token = (await tokenResponse.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!tokenResponse.ok || !token.access_token) return redirectToLogin(request, token.error || "oauth");

  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  const profile = (await profileResponse.json().catch(() => ({}))) as GoogleProfile;
  if (!profileResponse.ok || !profile.email || profile.email_verified === false) return redirectToLogin(request, "profile");
  if (await isJewelLinkSsoOnlyEmail(profile.email)) return redirectToLogin(request, "jewellink_required");

  const session = await findSessionForGoogleUser({ email: profile.email, name: profile.name });
  if (!session) return redirectToLogin(request, "unauthorized");

  const destination = new URL(destinationForSession(nextCookie, session), appBaseUrl(request));
  const response = NextResponse.redirect(destination);
  setSessionCookie(response, session);
  response.cookies.delete(OAUTH_STATE_COOKIE);
  response.cookies.delete(OAUTH_NEXT_COOKIE);
  return response;
}
