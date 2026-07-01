import { NextResponse } from "next/server";
import {
  createSessionToken,
  findSessionForGoogleUser,
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
} from "@/lib/server/auth";
import type { AuthSession } from "@/lib/server/auth";

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

function safeNext(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function destinationForSession(next: string, session: AuthSession) {
  const safe = safeNext(next);
  if (safe !== "/") return safe;
  if (session.role === "admin") return "/admin";
  if (session.role === "associate") return "/portal";
  return "/";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieHeader = request.headers.get("cookie") || "";
  const stateCookie = cookieHeader.match(new RegExp(`${OAUTH_STATE_COOKIE}=([^;]+)`))?.[1];
  const nextCookie = decodeURIComponent(cookieHeader.match(new RegExp(`${OAUTH_NEXT_COOKIE}=([^;]+)`))?.[1] || "/");
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

  const session = await findSessionForGoogleUser({ email: profile.email, name: profile.name });
  if (!session) return redirectToLogin(request, "unauthorized");

  const destination = new URL(destinationForSession(nextCookie, session), appBaseUrl(request));
  const response = NextResponse.redirect(destination);
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(SESSION_COOKIE, createSessionToken(session), { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 24 * 7 });
  response.cookies.delete(OAUTH_STATE_COOKIE);
  response.cookies.delete(OAUTH_NEXT_COOKIE);
  return response;
}
