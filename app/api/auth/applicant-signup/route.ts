import { createHash, randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import {
  applicantSignupEmailDeliveryReady,
  requestApplicantEmailVerification,
} from "@/lib/server/applicant-signup";
import { enforceRateLimit, rateLimit } from "@/lib/server/rate-limit";
import { validEmail } from "@/lib/server/request";

export const runtime = "nodejs";

const GENERIC_RESPONSE = {
  ok: true,
  message: "If this email can be used for JewelHire, we sent the next step. Check your inbox and spam folder.",
};
const UNAVAILABLE_RESPONSE = {
  error: {
    code: "signup_unavailable",
    message: "Applicant account setup is temporarily unavailable. Please try again later.",
  },
};
const PROVIDER_RESPONSE_FLOOR_MS = 250;
const PROVIDER_RESPONSE_JITTER_MS = 75;

function acceptedResponse() {
  return NextResponse.json(GENERIC_RESPONSE, { status: 202 });
}

function unavailableResponse() {
  return NextResponse.json(UNAVAILABLE_RESPONSE, { status: 503 });
}

async function waitForUniformProviderFloor(startedAt: number) {
  const targetMs = PROVIDER_RESPONSE_FLOOR_MS + randomInt(PROVIDER_RESPONSE_JITTER_MS + 1);
  const remainingMs = targetMs - (Date.now() - startedAt);
  if (remainingMs > 0) await new Promise((resolve) => setTimeout(resolve, remainingMs));
}

// Step one creates no user, password, profile ownership, consent, or session.
// Every valid address receives one provider call and the same public response;
// only the private email content differs for a new versus existing identity.
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "applicant-signup", { limit: 12, windowSeconds: 3600 });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!validEmail(email) || email.length > 320) {
    return NextResponse.json(
      { error: { code: "invalid_email", message: "Enter a valid email address." } },
      { status: 400 },
    );
  }

  // Share this cap across Cloud Run instances without storing the email itself
  // in the limiter table. The existing IP cap remains the first abuse boundary.
  const emailKey = createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 24);
  const emailLimit = await rateLimit(`applicant-signup-email:${emailKey}`, 3, 3600);
  if (!emailLimit.ok) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many attempts. Please wait before requesting another email." } },
      { status: 429, headers: { "Retry-After": String(emailLimit.retryAfterSeconds) } },
    );
  }

  // A dry run cannot deliver the secret token. Fail uniformly before any
  // account-state lookup rather than claiming that an unusable email was sent.
  if (!applicantSignupEmailDeliveryReady()) {
    return unavailableResponse();
  }

  const providerStartedAt = Date.now();
  try {
    const result = await requestApplicantEmailVerification({ email });
    await waitForUniformProviderFloor(providerStartedAt);
    if (result.notification.status !== "sent" || result.notification.delivery !== "accepted") {
      // Failure telemetry is intentionally address- and token-free.
      console.error("[applicant-signup] Verification provider did not accept the message", {
        provider: result.notification.provider,
        delivery: result.notification.delivery,
        reason: result.notification.reason || "unspecified",
      });
      return unavailableResponse();
    }
    return acceptedResponse();
  } catch (error) {
    // Do not vary the public response by account state or by which internal
    // issuance step failed. Logs contain no raw token or submitted address.
    console.error("[applicant-signup] Verification request could not be completed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    await waitForUniformProviderFloor(providerStartedAt);
    return unavailableResponse();
  }
}
