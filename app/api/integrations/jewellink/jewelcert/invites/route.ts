import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/server/postgres";
import { notifyJewelCertInviteCreated } from "@/lib/server/notifications";

function validBearer(header: string | null) {
  const configured = process.env.JEWELLINK_INTEGRATION_SHARED_SECRET || process.env.JEWELLINK_SSO_SHARED_SECRET || "";
  const presented = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!configured || !presented) return false;
  const a = Buffer.from(configured);
  const b = Buffer.from(presented);
  return a.length === b.length && timingSafeEqual(a, b);
}

function stableId(prefix: string, value: string) {
  return `${prefix}-jl-${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
}

function text(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  if (!validBearer(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const input = {
    idempotencyKey: text(body?.idempotencyKey),
    companyId: text(body?.companyId),
    locationId: text(body?.locationId),
    userId: text(body?.userId),
    requestedByUserId: text(body?.requestedByUserId),
    email: text(body?.email).toLowerCase(),
    fullName: text(body?.fullName, 160),
    jobTitle: text(body?.jobTitle, 160) || "JewelLink team member",
  };
  if (!input.idempotencyKey || !input.companyId || !input.locationId || !input.userId || !input.requestedByUserId || !input.fullName || !input.email.includes("@")) {
    return NextResponse.json({ error: "Valid idempotency, company, location, recipient, sender, name, and email fields are required" }, { status: 400 });
  }

  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const scope = await client.query<{ company_id: string; store_id: string; location_id: string; recipient_user_id: string | null; actor_user_id: string | null }>(
      `
        select c.id as company_id, s.id as store_id, l.id as location_id,
               (select id from users where jewellink_user_id = $3 limit 1) as recipient_user_id,
               (
                 select u.id
                 from users u
                 join store_users su on su.user_id = u.id and su.store_id = s.id and su.status = 'active'
                 where u.jewellink_user_id = $4
                 limit 1
               ) as actor_user_id
        from companies c
        join stores s on s.company_id = c.id and s.status <> 'archived'
        join locations l on l.store_id = s.id and l.jewellink_location_id = $2
        where c.jewellink_company_id = $1
        order by s.created_at asc
        limit 1
      `,
      [input.companyId, input.locationId, input.userId, input.requestedByUserId],
    );
    const linked = scope.rows[0];
    if (!linked) {
      await client.query("rollback");
      return NextResponse.json({ error: "JewelLink organization or location is not linked" }, { status: 404 });
    }

    const existingProfile = await client.query<{ id: string }>(
      `
        select id from applicant_profiles
        where owner_user_id = $1 or email_normalized = $2
        order by (owner_user_id = $1) desc, created_at asc
        limit 1
      `,
      [linked.recipient_user_id, input.email],
    );
    const profileId = existingProfile.rows[0]?.id || stableId("profile", input.userId);
    if (existingProfile.rows[0]) {
      await client.query(
        `update applicant_profiles set owner_user_id = coalesce(owner_user_id, $1), full_name = $2,
         email = $3, email_normalized = $3, resume_headline = $4, updated_at = now() where id = $5`,
        [linked.recipient_user_id, input.fullName, input.email, input.jobTitle, profileId],
      );
    } else {
      await client.query(
        `
          insert into applicant_profiles (
            id, owner_user_id, full_name, email, email_normalized, resume_headline, visibility
          ) values ($1, $2, $3, $4, $4, $5, 'private_store_application')
        `,
        [profileId, linked.recipient_user_id, input.fullName, input.email, input.jobTitle],
      );
    }

    const applicationId = stableId("application", `${linked.store_id}:${input.userId}`);
    await client.query(
      `
        insert into applications (
          id, store_id, applicant_profile_id, source, stage, status_reason
        ) values ($1, $2, $3, 'jewellink_employee', 'hired', 'JewelLink employee JewelCert')
        on conflict (id) do update
        set applicant_profile_id = excluded.applicant_profile_id,
            status_reason = excluded.status_reason,
            updated_at = now()
      `,
      [applicationId, linked.store_id, profileId],
    );

    const inviteId = stableId("jewelcert", `${linked.store_id}:${input.idempotencyKey}`);
    const invite = await client.query<{ id: string; status: string }>(
      `
        insert into jewelcert_invites (
          id, application_id, store_id, assessment_package_id, sent_by_user_id,
          sent_to_email, status, component_ids, expires_at, sent_at,
          external_request_id, external_user_id, external_company_id, external_location_id
        ) values (
          $1, $2, $3, 'gemmatch', $4, $5, 'sent', '["gemmatch"]'::jsonb,
          now() + interval '14 days', now(), $6, $7, $8, $9
        )
        on conflict (store_id, external_request_id) where external_request_id is not null
        do update set sent_to_email = excluded.sent_to_email
        returning id, status
      `,
      [inviteId, applicationId, linked.store_id, linked.actor_user_id, input.email, input.idempotencyKey, input.userId, input.companyId, input.locationId],
    );
    await client.query("commit");

    const notification = await notifyJewelCertInviteCreated({
      toEmail: input.email,
      recipientName: input.fullName,
      inviteId: invite.rows[0].id,
      applicationId,
      storeId: linked.store_id,
      itemCount: 1,
    });
    return NextResponse.json({
      inviteId: invite.rows[0].id,
      applicationId,
      status: invite.rows[0].status,
      notification,
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    return NextResponse.json({ error: "Unable to create JewelCert invite" }, { status: 500 });
  } finally {
    client.release();
  }
}
