import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { attemptBestEffortTransactionOperation, withReplacingActionToken } from "@/lib/server/action-tokens";
import { requireAdminAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { notifyStoreOwnerClaim } from "@/lib/server/notifications";
import { getPostgresPool } from "@/lib/server/postgres";
import { isConfiguredAdminEmail } from "@/lib/server/auth";

const CLAIM_TTL_MINUTES = 60 * 24 * 3;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await requireAdminAccess("admin.company_users.send_claim");
  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: { code: "missing_user", message: "Choose a Store Admin to receive the access link." } }, { status: 400 });
  }

  const pool = getPostgresPool();
  const result = await pool.query<{
    id: string;
    email: string;
    name: string;
    company_name: string;
    standalone_eligible: boolean;
  }>(
    `
      select
        u.id,
        u.email,
        u.name,
        c.name as company_name,
        (
          c.status in ('active', 'trialing')
          and (
            exists (
              select 1
              from company_access_entitlements cae
              where cae.company_id = c.id
                and cae.source <> 'jewellink_included'
                and cae.status = 'active'
                and (cae.expires_at is null or cae.expires_at > now())
            )
            or exists (
              select 1
              from subscriptions sub
              where sub.company_id = c.id
                and sub.status in ('active', 'trialing')
                and (sub.current_period_end is null or sub.current_period_end > now())
            )
          )
        ) as standalone_eligible
      from users u
      join store_users su on su.user_id = u.id and su.status = 'active'
      join stores s on s.id = su.store_id and s.status <> 'archived'
      join companies c on c.id = s.company_id
      where u.id = $1
        and c.id = $2
        and u.status = 'active'
        and su.role in ('store_owner', 'admin')
      order by case su.role when 'store_owner' then 0 else 1 end
      limit 1
    `,
    [userId, params.id],
  );
  const owner = result.rows[0];
  if (!owner) {
    return NextResponse.json(
      { error: { code: "owner_not_found", message: "That active Store Admin was not found in this company." } },
      { status: 404 },
    );
  }
  if (isConfiguredAdminEmail(owner.email)) {
    return NextResponse.json(
      {
        error: {
          code: "jewellink_required",
          message: "Platform administrators authenticate through JewelLink MFA and cannot receive native password-access claims.",
        },
      },
      { status: 409 },
    );
  }
  if (!owner.standalone_eligible) {
    return NextResponse.json(
      {
        error: {
          code: "standalone_entitlement_required",
          message: "Activate a paid, comped, or contract JewelHire entitlement before sending a password-access claim.",
        },
      },
      { status: 409 },
    );
  }

  const issuance = await withReplacingActionToken<{
    delivered: boolean;
    notification: Awaited<ReturnType<typeof notifyStoreOwnerClaim>>;
  }>(
    {
      purpose: "account_claim",
      userId: owner.id,
      email: owner.email,
      companyId: params.id,
      ttlMinutes: CLAIM_TTL_MINUTES,
    },
    async ({ client, token, tokenId }) => {
      const notification = await notifyStoreOwnerClaim({
        toEmail: owner.email,
        name: owner.name,
        companyName: owner.company_name,
        token,
        existingAccount: true,
        accessRecovery: true,
      });
      const delivered = notification.status === "sent" || notification.status === "dry_run";
      if (!delivered) {
        return { commit: false, value: { delivered, notification } };
      }

      const audit = await attemptBestEffortTransactionOperation(client, () =>
        client.query(
          `
            insert into admin_audit_entries (
              id, actor_user_id, actor_label, action, target_type, target_id, target_label, metadata
            )
            values (
              $1,
              case when exists (select 1 from users where id = $2) then $2 else null end,
              $3,
              'Sent owner access claim',
              'user',
              $4,
              $5,
              $6::jsonb
            )
          `,
          [
            `admin-audit-${randomBytes(12).toString("hex")}`,
            admin.userId,
            admin.email,
            owner.id,
            owner.name,
            JSON.stringify({ companyId: params.id, delivery: notification.status, tokenId }),
          ],
        ),
      );
      if (!audit.ok) {
        // Delivery already happened; never roll the usable link back or tell an
        // administrator to retry solely because the audit write failed.
        console.error("[admin claim-link] Email sent but audit entry could not be recorded", audit.error);
      }
      return { commit: true, value: { delivered, notification } };
    },
  );

  if (!issuance.delivered) {
    return NextResponse.json(
      {
        error: {
          code: "delivery_failed",
          message: "The secure link could not be delivered. Check email delivery settings and try again.",
        },
        notification: issuance.notification,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    recipient: { id: owner.id, name: owner.name, email: owner.email },
    expiresInHours: 72,
    notification: issuance.notification,
  });
});
