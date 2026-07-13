import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createActionToken, invalidateActionTokens } from "@/lib/server/action-tokens";
import { requireAdminAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { notifyStoreOwnerClaim } from "@/lib/server/notifications";
import { getPostgresPool } from "@/lib/server/postgres";

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
  }>(
    `
      select u.id, u.email, u.name, c.name as company_name
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

  await invalidateActionTokens("account_claim", owner.id);
  const token = await createActionToken({
    purpose: "account_claim",
    userId: owner.id,
    email: owner.email,
    ttlMinutes: CLAIM_TTL_MINUTES,
  });
  const notification = await notifyStoreOwnerClaim({
    toEmail: owner.email,
    name: owner.name,
    companyName: owner.company_name,
    token,
    existingAccount: true,
    accessRecovery: true,
  });

  if (notification.status !== "sent" && notification.status !== "dry_run") {
    await invalidateActionTokens("account_claim", owner.id);
    return NextResponse.json(
      { error: { code: "delivery_failed", message: "The secure link could not be delivered. Check email delivery settings and try again." }, notification },
      { status: 503 },
    );
  }

  try {
    await pool.query(
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
        JSON.stringify({ companyId: params.id, delivery: notification.status }),
      ],
    );
  } catch (error) {
    // Delivery already happened; never tell an administrator to retry and send a
    // duplicate email only because the audit write failed.
    console.error("[admin claim-link] Email sent but audit entry could not be recorded", error);
  }

  return NextResponse.json({
    ok: true,
    recipient: { id: owner.id, name: owner.name, email: owner.email },
    expiresInHours: 72,
    notification,
  });
});
