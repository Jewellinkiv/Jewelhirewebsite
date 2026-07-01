import { NextResponse } from "next/server";
import { createSessionToken, findSessionForGoogleUser, SESSION_COOKIE } from "@/lib/server/auth";
import { verifyFirebaseIdToken } from "@/lib/server/firebase-auth";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const runtime = "nodejs";

function safeNext(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export const POST = withApiErrorHandling(async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.idToken || typeof body.idToken !== "string") {
    return NextResponse.json({ error: { code: "invalid_request", message: "Firebase id token is required." } }, { status: 400 });
  }

  const firebaseUser = await verifyFirebaseIdToken(body.idToken).catch(() => undefined);
  if (!firebaseUser) {
    return NextResponse.json({ error: { code: "invalid_firebase_token", message: "Firebase sign-in could not be verified." } }, { status: 401 });
  }

  const session = await findSessionForGoogleUser({ email: firebaseUser.email, name: firebaseUser.name });
  if (!session) {
    return NextResponse.json({ error: { code: "unauthorized", message: "That Google account is not active in JewelHire yet." } }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true, next: safeNext(body.next) });
  response.cookies.set(SESSION_COOKIE, createSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
});
