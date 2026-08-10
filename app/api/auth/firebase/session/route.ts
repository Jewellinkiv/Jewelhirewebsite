import { NextResponse } from "next/server";
import { findSessionForGoogleUser, isJewelLinkSsoOnlyEmail, setSessionCookie } from "@/lib/server/auth";
import { verifyFirebaseIdToken } from "@/lib/server/firebase-auth";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import type { AuthSession } from "@/lib/server/auth";
import { safeSameOriginPathOrRoot } from "@/lib/server/safe-redirect";

export const runtime = "nodejs";

function destinationForSession(next: unknown, session: AuthSession) {
  const safe = safeSameOriginPathOrRoot(next);
  if (safe !== "/") return safe;
  if (session.role === "admin") return "/admin";
  if (session.role === "associate") return "/portal";
  return "/dashboard";
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

  if (await isJewelLinkSsoOnlyEmail(firebaseUser.email)) {
    return NextResponse.json(
      { error: { code: "jewellink_required", message: "This account must continue with JewelLink and complete MFA to sign in." } },
      { status: 403 },
    );
  }

  const session = await findSessionForGoogleUser({ email: firebaseUser.email, name: firebaseUser.name });
  if (!session) {
    return NextResponse.json({ error: { code: "unauthorized", message: "That Google account is not active in JewelHire yet." } }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true, next: destinationForSession(body.next, session) });
  setSessionCookie(response, session);
  return response;
});
