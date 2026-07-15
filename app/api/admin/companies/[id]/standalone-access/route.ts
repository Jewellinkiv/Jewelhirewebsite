import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { isConfiguredAdminEmail } from "@/lib/server/auth";
import { reconcileCurrentJewelLinkCompanyAccess } from "@/lib/server/jewellink-company-access";
import { notifyStandaloneCheckout } from "@/lib/server/notifications";
import { getPostgresPool } from "@/lib/server/postgres";
import {
  createStandaloneCheckoutRequest,
  getCompanyStandaloneAccessState,
} from "@/lib/server/standalone-access";
import {
  getStoreOwnerBillingCheckoutReadiness,
  isStoreOwnerBillingInterval,
  storeOwnerBillingOffer,
} from "@/lib/server/store-owner-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withApiErrorHandling(async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  await requireAdminAccess("admin.company_billing.read");
  const access = await getCompanyStandaloneAccessState(params.id);
  if (!access.companyExists) {
    return NextResponse.json({ error: { code: "company_not_found", message: "Company not found." } }, { status: 404 });
  }
  const billing = getStoreOwnerBillingCheckoutReadiness();
  return NextResponse.json({
    access,
    billing: access.schemaReady
      ? billing
      : {
          ...billing,
          configured: false,
          offers: billing.offers.map((offer) => ({ ...offer, configured: false, missing: [...offer.missing, "0025_standalone_billing_recovery"] })),
          missing: [...billing.missing, "0025_standalone_billing_recovery"],
        },
  });
});

export const POST = withApiErrorHandling(async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const admin = await requireAdminAccess("admin.company_billing.send_checkout");
  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  if (!userId) {
    return NextResponse.json(
      { error: { code: "missing_user", message: "Choose the store owner who should receive checkout." } },
      { status: 400 },
    );
  }
  if (!isStoreOwnerBillingInterval(body?.billingInterval)) {
    return NextResponse.json(
      { error: { code: "billing_interval_required", message: "Choose monthly or annual billing." } },
      { status: 400 },
    );
  }

  const jewelLinkAccess = await reconcileCurrentJewelLinkCompanyAccess({
    companyId: params.id,
    actorUserId: admin.userId,
    actorEmail: admin.email,
  });
  if (!jewelLinkAccess.ok) {
    return NextResponse.json(
      {
        error: {
          code: "jewellink_access_unverified",
          message: "Current JewelLink membership could not be verified. No checkout was created; retry after the integration is healthy.",
        },
      },
      { status: 503 },
    );
  }
  if (jewelLinkAccess.linked && jewelLinkAccess.active) {
    return NextResponse.json(
      {
        error: {
          code: "jewellink_access_active",
          message: "This company's JewelHire access is still included with its active JewelLink membership. Do not send paid standalone checkout.",
        },
      },
      { status: 409 },
    );
  }

  const ownerResult = await getPostgresPool().query<{
    id: string;
    email: string;
    name: string;
    company_name: string;
    store_id: string;
  }>(
    `
      select u.id, u.email, u.name, c.name as company_name, owner_store.id as store_id
      from users u
      join store_users membership on membership.user_id = u.id
        and membership.status = 'active'
        and membership.role in ('store_owner', 'admin')
      join stores membership_store on membership_store.id = membership.store_id
        and membership_store.company_id = $2
        and membership_store.status <> 'archived'
      join companies c on c.id = membership_store.company_id
      join lateral (
        select retained_store.id
        from stores retained_store
        where retained_store.company_id = c.id and retained_store.status <> 'archived'
        order by retained_store.created_at asc, retained_store.id asc
        limit 1
      ) owner_store on true
      where u.id = $1 and u.status = 'active'
      order by case membership.role when 'store_owner' then 0 else 1 end
      limit 1
    `,
    [userId, params.id],
  );
  const owner = ownerResult.rows[0];
  if (!owner) {
    return NextResponse.json(
      { error: { code: "owner_not_found", message: "That active store owner was not found in this company." } },
      { status: 404 },
    );
  }
  if (isConfiguredAdminEmail(owner.email)) {
    return NextResponse.json(
      { error: { code: "jewellink_required", message: "Platform administrators cannot receive store-owner billing or native-access links." } },
      { status: 409 },
    );
  }

  const checkout = await createStandaloneCheckoutRequest({
    companyId: params.id,
    storeId: owner.store_id,
    requestedForUserId: owner.id,
    createdByUserId: admin.userId,
    billingInterval: body.billingInterval,
    customerEmail: owner.email,
  });
  if (!checkout.ok) {
    const message = checkout.reason === "standalone_access_active"
      ? "Standalone access is already active. Refresh the status, then send the secure account claim link."
      : checkout.reason === "jewellink_access_active"
        ? "This company's JewelHire access is still included with its active JewelLink membership. Do not send paid standalone checkout."
      : checkout.reason === "billing_schema_not_ready"
        ? "Standalone billing is temporarily unavailable while its database migration finishes."
      : checkout.reason === "billing_not_configured"
        ? "The selected Stripe price is not configured."
        : checkout.reason === "stripe_unavailable"
          ? "Stripe could not be reached. The same checkout can be retried safely."
          : "Secure checkout could not be created.";
    return NextResponse.json(
      { error: { code: checkout.reason, message } },
      { status: checkout.reason === "standalone_access_active" || checkout.reason === "jewellink_access_active" ? 409 : 503 },
    );
  }

  const offer = storeOwnerBillingOffer(body.billingInterval);
  const notification = await notifyStandaloneCheckout({
    toEmail: owner.email,
    name: owner.name,
    companyId: params.id,
    companyName: owner.company_name,
    checkoutUrl: checkout.url,
    billingInterval: offer.interval,
    amountCents: offer.amountCents,
    requestId: checkout.requestId,
  });
  const delivered = notification.status === "sent" || notification.status === "dry_run";
  if (!delivered) {
    return NextResponse.json(
      {
        error: {
          code: "delivery_failed",
          message: "Checkout was prepared, but the email was not accepted. Retry to reuse the same safe checkout session.",
        },
        notification,
      },
      { status: 503 },
    );
  }

  try {
    await getPostgresPool().query(
      `insert into admin_audit_entries (
         id, actor_user_id, actor_label, action, target_type, target_id, target_label, metadata
       )
       values (
         $1,
         case when exists (select 1 from users where id = $2) then $2 else null end,
         $3,
         'Sent standalone checkout',
         'company', $4, $5, $6::jsonb
       )`,
      [
        `admin-audit-${randomBytes(12).toString("hex")}`,
        admin.userId,
        admin.email,
        params.id,
        owner.company_name,
        JSON.stringify({
          requestId: checkout.requestId,
          recipientUserId: owner.id,
          billingInterval: offer.interval,
          amountCents: offer.amountCents,
          delivery: notification.status,
          reused: checkout.reused,
          jewelLinkAccess: jewelLinkAccess.linked
            ? {
                state: jewelLinkAccess.state,
                changed: jewelLinkAccess.changed,
                upstreamUpdatedAt: jewelLinkAccess.upstreamUpdatedAt,
              }
            : { linked: false },
        }),
      ],
    );
  } catch (error) {
    // Delivery already happened. Never tell an operator to retry a checkout
    // email solely because its secondary audit write failed.
    console.error("[standalone checkout] Email sent but audit entry could not be recorded", error);
  }

  return NextResponse.json({
    ok: true,
    recipient: { id: owner.id, name: owner.name, email: owner.email },
    offer,
    checkoutExpiresInHours: 24,
    notification,
    jewelLinkAccess,
    access: await getCompanyStandaloneAccessState(params.id),
  });
});
