import { NextResponse } from "next/server";
import { findActionTokenSubject, isActionTokenValid } from "@/lib/server/action-tokens";
import { completeStandaloneAccountClaim, isStrongPassword } from "@/lib/server/password-auth";
import { findSessionForGoogleUser, isConfiguredAdminEmail, setSessionCookie } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

function nextForRole(role?: string) {
  if (role === "associate") return "/portal";
  if (role === "admin") return "/admin";
  return "/";
}

// GET: lightweight preview to tell the claim page whether the token is still
// valid, WITHOUT consuming it. POST performs the one-shot consume + set password.
export async function GET(request: Request) {
  const limited = await enforceRateLimit(request, "account-claim-preview", { limit: 100, windowSeconds: 900 });
  if (limited) return limited;
  const token = new URL(request.url).searchParams.get("token") || "";
  const valid = await isActionTokenValid({ purpose: "account_claim", token });
  return NextResponse.json({ valid });
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "account-claim", { limit: 12, windowSeconds: 900 });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!isStrongPassword(password)) {
    return NextResponse.json(
      { error: { code: "weak_password", message: "Use at least 12 characters, including a letter and a number." } },
      { status: 400 },
    );
  }

  const claim = await findActionTokenSubject({ purpose: "account_claim", token });
  if (!claim) {
    return NextResponse.json(
      { error: { code: "invalid_token", message: "This link is invalid or has expired. Request a new one." } },
      { status: 400 },
    );
  }

  if (isConfiguredAdminEmail(claim.email) || (claim.currentEmail && isConfiguredAdminEmail(claim.currentEmail))) {
    return NextResponse.json(
      {
        error: {
          code: "jewellink_required",
          message: "Platform administrators must continue with JewelLink and complete MFA to sign in.",
        },
      },
      { status: 403 },
    );
  }

  const converted = await completeStandaloneAccountClaim({ token, password });
  if (!converted.ok && converted.reason === "invalid_token") {
    return NextResponse.json(
      { error: { code: "invalid_token", message: "This link is invalid or has expired. Request a new one." } },
      { status: 400 },
    );
  }
  if (!converted.ok && converted.reason === "jewellink_required") {
    return NextResponse.json(
      {
        error: {
          code: "jewellink_required",
          message: "Platform administrators must continue with JewelLink and complete MFA to sign in.",
        },
      },
      { status: 403 },
    );
  }
  if (!converted.ok) {
    return NextResponse.json(
      {
        error: {
          code: "standalone_entitlement_required",
          message: "This account is still managed by JewelLink. An active standalone JewelHire plan is required before claiming password access.",
        },
      },
      { status: 403 },
    );
  }
  const session = await findSessionForGoogleUser({ email: converted.email });
  // If the account isn't active (findSessionForGoogleUser returns nothing), don't
  // claim a logged-in landing — send them to sign in.
  const response = NextResponse.json({ ok: true, next: session ? nextForRole(session.role) : "/login" });
  if (session) setSessionCookie(response, session);
  return response;
}
