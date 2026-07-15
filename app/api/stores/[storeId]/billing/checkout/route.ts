import { NextResponse } from "next/server";
import { getSessionContext, requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresPool } from "@/lib/server/postgres";
import { createStandaloneCheckoutRequest, getCompanyStandaloneAccessState } from "@/lib/server/standalone-access";
import { getStoreOwnerBillingCheckoutReadiness, isStoreOwnerBillingInterval } from "@/lib/server/store-owner-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function companyIdForStore(storeId: string) {
  try {
    const result = await getPostgresPool().query<{ company_id: string }>(
      "select company_id from stores where id = $1 limit 1",
      [storeId],
    );
    return result.rows[0]?.company_id || "";
  } catch {
    return "";
  }
}

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const session = await getSessionContext();
  await requireStoreAccess(params.storeId, "billing.checkout.read", session);
  const companyId = await companyIdForStore(params.storeId);
  const access = companyId ? await getCompanyStandaloneAccessState(companyId) : null;
  const billing = getStoreOwnerBillingCheckoutReadiness();
  return NextResponse.json({
    ...billing,
    ...(access?.schemaReady
      ? {}
      : {
          configured: false,
          offers: billing.offers.map((offer) => ({ ...offer, configured: false, missing: [...offer.missing, "0025_standalone_billing_recovery"] })),
          missing: [...billing.missing, "0025_standalone_billing_recovery"],
        }),
    access,
  });
});

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const session = await getSessionContext();
  await requireStoreAccess(params.storeId, "billing.checkout.start", session);
  const body = await request.json().catch(() => ({}));
  if (!isStoreOwnerBillingInterval(body?.billingInterval)) {
    return NextResponse.json(
      { error: { code: "billing_interval_required", message: "Choose monthly or annual billing." } },
      { status: 400 },
    );
  }

  const readiness = getStoreOwnerBillingCheckoutReadiness();
  const selectedOffer = readiness.offers.find((offer) => offer.interval === body.billingInterval);
  if (!selectedOffer?.configured) {
    return NextResponse.json(
      { error: { code: "stripe_billing_not_configured", message: "Stripe billing is not configured yet.", missing: readiness.missing } },
      { status: 503 },
    );
  }

  const companyId = await companyIdForStore(params.storeId);
  const checkout = await createStandaloneCheckoutRequest({
    storeId: params.storeId,
    companyId,
    requestedForUserId: session.userId,
    createdByUserId: session.userId,
    billingInterval: body.billingInterval,
    customerEmail: session.email,
  });
  if (!checkout.ok) {
    const message = checkout.reason === "standalone_access_active"
      ? "This company already has active standalone access."
      : checkout.reason === "jewellink_access_active"
        ? "Standalone access is included while this company's JewelLink membership is active."
      : checkout.reason === "checkout_payment_processing"
        ? "An earlier payment is still being confirmed. Refresh shortly; no replacement checkout was created."
      : checkout.reason === "billing_schema_not_ready"
        ? "Billing is temporarily unavailable while a database migration finishes."
      : checkout.reason === "owner_not_found"
        ? "Only an active store owner can start checkout."
        : checkout.reason === "billing_not_configured"
          ? "The selected billing option is not configured."
          : "Stripe checkout is temporarily unavailable.";
    return NextResponse.json(
      { error: { code: checkout.reason, message } },
      { status: checkout.reason === "standalone_access_active" || checkout.reason === "jewellink_access_active" || checkout.reason === "checkout_payment_processing" ? 409 : checkout.reason === "owner_not_found" ? 403 : 503 },
    );
  }
  return NextResponse.json({ url: checkout.url, mode: readiness.mode, allowPromotionCodes: readiness.allowPromotionCodes });
});
