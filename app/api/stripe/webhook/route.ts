import { NextResponse } from "next/server";
import { handleStripeBillingEvent, verifyStripeWebhookSignature } from "@/lib/server/stripe-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const verification = verifyStripeWebhookSignature(rawBody, request.headers.get("stripe-signature"));
  if (!verification.ok) {
    return NextResponse.json(
      { error: { code: verification.code, message: verification.message } },
      { status: verification.status },
    );
  }

  const result = await handleStripeBillingEvent(verification.event);
  return NextResponse.json({ received: true, ...result });
}

export function GET() {
  return NextResponse.json({ error: { code: "method_not_allowed", message: "Stripe webhooks must use POST." } }, { status: 405 });
}
