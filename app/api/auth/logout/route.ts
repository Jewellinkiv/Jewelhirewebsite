import { NextResponse } from "next/server";
import { OAUTH_NEXT_COOKIE, OAUTH_STATE_COOKIE, SESSION_COOKIE } from "@/lib/server/auth";

function appBaseUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
}

export function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", appBaseUrl(request)), { status: 303 });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(OAUTH_STATE_COOKIE);
  response.cookies.delete(OAUTH_NEXT_COOKIE);
  return response;
}

export function GET(request: Request) {
  return POST(request);
}
