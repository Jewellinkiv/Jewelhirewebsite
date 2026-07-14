import { NextResponse } from "next/server";
import { completeApplicantEmailVerification } from "@/lib/server/applicant-signup";
import { findSessionForGoogleUser, setSessionCookie } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "applicant-signup-verify", { limit: 20, windowSeconds: 900 });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const result = await completeApplicantEmailVerification({
    token: typeof body.token === "string" ? body.token : "",
    name: typeof body.name === "string" ? body.name : "",
    password: typeof body.password === "string" ? body.password : "",
    legalConsent: body.legalConsent,
    legalPolicyVersion: body.legalPolicyVersion,
  });

  if (!result.ok) {
    if (result.reason === "invalid_name") {
      return NextResponse.json(
        { error: { code: "invalid_name", message: "Enter your full name to continue." } },
        { status: 400 },
      );
    }
    if (result.reason === "weak_password") {
      return NextResponse.json(
        { error: { code: "weak_password", message: "Use 12 to 256 characters, including a letter and a number." } },
        { status: 400 },
      );
    }
    if (result.reason === "legal_consent_required") {
      return NextResponse.json(
        { error: { code: "legal_consent_required", message: "Accept the Privacy Policy and Terms of Service to continue." } },
        { status: 400 },
      );
    }
    if (result.reason === "profile_conflict") {
      return NextResponse.json(
        { error: { code: "profile_conflict", message: "This email is linked to another applicant profile. Contact support for help." } },
        { status: 409 },
      );
    }
    if (result.reason === "account_exists" || result.reason === "jewellink_required") {
      return NextResponse.json({
        ok: true,
        existingAccount: true,
        next: result.reason === "jewellink_required" ? "/login?error=jewellink_required" : "/login",
      });
    }
    return NextResponse.json(
      { error: { code: "invalid_token", message: "This setup link is invalid or has expired. Request a new one." } },
      { status: 400 },
    );
  }

  try {
    const session = await findSessionForGoogleUser({ email: result.email, name: result.name });
    const response = NextResponse.json({ ok: true, next: session?.userId === result.userId ? "/portal" : "/login" });
    if (session?.userId === result.userId) setSessionCookie(response, session);
    return response;
  } catch (error) {
    // Identity creation has already committed and the link is consumed. Treat
    // session hydration as best-effort so retrying cannot look like a failed
    // account creation or produce a second credential.
    console.error("[applicant-signup] Account created but session hydration failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ ok: true, next: "/login" });
  }
}
