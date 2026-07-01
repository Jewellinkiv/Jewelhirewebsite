import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/server/auth";

export function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export function GET(request: Request) {
  return POST(request);
}
