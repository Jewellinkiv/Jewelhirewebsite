import { NextResponse } from "next/server";
import { isConfiguredAdminEmail } from "@/lib/server/auth";
import { userExistsForEmail } from "@/lib/server/invite-claim";
import { createPendingStoreSignup } from "@/lib/server/store-signup";
import { createStoreSignupCheckoutLink, getStoreOwnerBillingCheckoutReadiness } from "@/lib/server/stripe-billing";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { validEmail } from "@/lib/server/request";
import { acceptsCurrentLegalTerms } from "@/lib/legal";
import { recordLegalConsent } from "@/lib/server/legal-consent";

export const runtime = "nodejs";

// Start a store-owner paid signup: capture the pending signup and hand back a
// Stripe payment-link URL. The account is only provisioned once the webhook
// confirms payment — see lib/server/store-signup.ts.
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "store-signup", { limit: 12, windowSeconds: 3600 });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  const ownerName = typeof body.ownerName === "string" ? body.ownerName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const promoCode = typeof body.promoCode === "string" ? body.promoCode.trim() : "";

  if (companyName.length < 2) {
    return NextResponse.json({ error: { code: "invalid_company", message: "Enter your store or company name." } }, { status: 400 });
  }
  if (!validEmail(email)) {
    return NextResponse.json({ error: { code: "invalid_email", message: "Enter a valid email address." } }, { status: 400 });
  }
  if (!acceptsCurrentLegalTerms(body)) {
    return NextResponse.json(
      { error: { code: "legal_consent_required", message: "Accept the Privacy Policy and Terms of Service to continue." } },
      { status: 400 },
    );
  }
  if (isConfiguredAdminEmail(email)) {
    return NextResponse.json(
      { error: { code: "jewellink_required", message: "Platform administrators must continue with JewelLink and complete MFA to sign in." } },
      { status: 403 },
    );
  }
  if (await userExistsForEmail(email)) {
    return NextResponse.json(
      { error: { code: "account_exists", message: "An account with this email already exists. Sign in instead." } },
      { status: 409 },
    );
  }

  const readiness = getStoreOwnerBillingCheckoutReadiness();
  if (!readiness.configured) {
    return NextResponse.json(
      { error: { code: "billing_unavailable", message: "Store signup isn't available yet. Please contact JewelHire." } },
      { status: 503 },
    );
  }

  await recordLegalConsent({
    email,
    source: "store_signup",
    context: { companyName },
  });

  const { id } = await createPendingStoreSignup({ companyName, ownerName, ownerEmail: email, promoCode });
  const checkoutUrl = createStoreSignupCheckoutLink({ pendingId: id, promotionCode: promoCode });
  if (!checkoutUrl) {
    return NextResponse.json(
      { error: { code: "billing_unavailable", message: "We couldn't start checkout. Please try again." } },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, checkoutUrl });
}
