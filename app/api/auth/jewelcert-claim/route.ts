import { NextResponse } from "next/server";
import { completeJewelCertInviteClaim, isInviteIdCandidate } from "@/lib/server/invite-claim";
import { findSessionForGoogleUser, setSessionCookie } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

// Claim: create the applicant's account (associate), set a password, log them in.
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "jewelcert-claim", { limit: 12, windowSeconds: 900 });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const inviteId = typeof body.inviteId === "string" ? body.inviteId : "";
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name : "";
  if (!isInviteIdCandidate(inviteId)) {
    return NextResponse.json(
      { error: { code: "invalid_link", message: "This claim link is invalid." } },
      { status: 400 },
    );
  }
  const next = `/bundle/${inviteId}`;
  const result = await completeJewelCertInviteClaim({
    inviteId,
    token,
    password,
    name,
    legalConsent: body.legalConsent,
    legalPolicyVersion: body.legalPolicyVersion,
  });
  if (!result.ok) {
    if (result.reason === "existing_account") {
      return NextResponse.json({ existingAccount: true, next });
    }
    if (result.reason === "jewellink_required") {
      return NextResponse.json({
        existingAccount: true,
        next,
        loginPath: `/login?error=jewellink_required&next=${encodeURIComponent(next)}`,
      });
    }
    if (result.reason === "profile_conflict") {
      return NextResponse.json(
        { error: { code: "profile_conflict", message: "This email is linked to another applicant profile. Contact support for help." } },
        { status: 409 },
      );
    }
    if (result.reason === "legal_consent_required") {
      return NextResponse.json(
        { error: { code: "legal_consent_required", message: "Accept the Privacy Policy and Terms of Service to continue." } },
        { status: 400 },
      );
    }
    if (result.reason === "weak_password") {
      return NextResponse.json(
        { error: { code: "weak_password", message: "Use 12 to 256 characters, including a letter and a number." } },
        { status: 400 },
      );
    }
    if (result.reason === "invalid_name") {
      return NextResponse.json(
        { error: { code: "invalid_name", message: "Your name must be 160 characters or fewer." } },
        { status: 400 },
      );
    }
    const invalidLink = result.reason === "invalid_link";
    return NextResponse.json(
      {
        error: {
          code: invalidLink ? "invalid_link" : "invite_unavailable",
          message: invalidLink
            ? "This claim link is invalid."
            : "This JewelCert link has expired or is no longer available.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const session = await findSessionForGoogleUser({ email: result.email, name: result.name });
    const signedIn = session?.userId === result.userId;
    const response = NextResponse.json({ ok: true, next: signedIn ? next : "/login" });
    if (signedIn && session) setSessionCookie(response, session);
    return response;
  } catch (error) {
    // The account transaction has committed. Session hydration is best-effort:
    // report success and send the user to login rather than suggesting that a
    // retry should create the identity again.
    console.error("[jewelcert-claim] Account created but session hydration failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ ok: true, next: "/login" });
  }
}
