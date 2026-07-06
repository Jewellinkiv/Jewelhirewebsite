import { NextResponse } from "next/server";
import { userExistsForEmail } from "@/lib/server/invite-claim";
import { createPendingStoreSignup } from "@/lib/server/store-signup";
import { createStoreSignupCheckoutLink, getStoreOwnerBillingCheckoutReadiness } from "@/lib/server/stripe-billing";

export const runtime = "nodejs";

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Start a store-owner paid signup: capture the pending signup and hand back a
// Stripe payment-link URL. The account is only provisioned once the webhook
// confirms payment — see lib/server/store-signup.ts.
export async function POST(request: Request) {
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
