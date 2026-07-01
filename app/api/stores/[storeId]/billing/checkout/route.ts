import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPostgresPool } from "@/lib/server/postgres";
import { createStoreOwnerBillingLink, getStoreOwnerBillingCheckoutReadiness } from "@/lib/server/stripe-billing";

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

function validPromotionCode(value: unknown) {
  if (value == null || value === "") return true;
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value.trim());
}

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  await requireStoreAccess(params.storeId, "billing.checkout.read");
  return NextResponse.json(getStoreOwnerBillingCheckoutReadiness());
});

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  await requireStoreAccess(params.storeId, "billing.checkout.start");
  const body = await request.json().catch(() => ({}));
  if (!validPromotionCode(body?.promotionCode)) {
    return NextResponse.json(
      { error: { code: "invalid_promotion_code", message: "Promotion code can only contain letters, numbers, dashes, or underscores." } },
      { status: 400 },
    );
  }

  const readiness = getStoreOwnerBillingCheckoutReadiness();
  if (!readiness.configured) {
    return NextResponse.json(
      { error: { code: "stripe_billing_not_configured", message: "Stripe billing is not configured yet.", missing: readiness.missing } },
      { status: 503 },
    );
  }

  const url = createStoreOwnerBillingLink({
    storeId: params.storeId,
    companyId: await companyIdForStore(params.storeId),
    promotionCode: body?.promotionCode,
  });
  return NextResponse.json({ url, mode: readiness.mode, allowPromotionCodes: readiness.allowPromotionCodes });
});
