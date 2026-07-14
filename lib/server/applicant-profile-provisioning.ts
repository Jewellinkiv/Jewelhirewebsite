import type { PoolClient } from "pg";

type EnsureApplicantProfileInput = {
  userId: string;
  email: string;
  name?: string | null;
  profileId: string;
};

export class ApplicantProfileOwnershipConflictError extends Error {
  constructor() {
    super("That applicant profile belongs to a different user.");
    this.name = "ApplicantProfileOwnershipConflictError";
  }
}

/**
 * Establish the profile invariant required by every applicant-facing API.
 *
 * Public applications can create profiles before the applicant has an account,
 * so a verified account may adopt matching rows only while they are unowned.
 * A row already owned by another user is never reassigned.
 */
export async function ensureApplicantProfileForUser(
  client: PoolClient,
  input: EnsureApplicantProfileInput,
) {
  const email = input.email.trim().toLowerCase();
  const fullName = input.name?.trim() || email;
  if (!input.userId || !input.profileId || !email.includes("@")) {
    throw new Error("A valid applicant identity is required.");
  }

  const conflictingOwner = await client.query<{ id: string }>(
    `select id
     from applicant_profiles
     where (email_normalized = $1 or id = $3)
       and owner_user_id is not null
       and owner_user_id <> $2
     order by created_at asc, id asc
     limit 1`,
    [email, input.userId, input.profileId],
  );
  if (conflictingOwner.rows[0]) {
    throw new ApplicantProfileOwnershipConflictError();
  }

  const adopted = await client.query<{ id: string }>(
    `update applicant_profiles
     set owner_user_id = $1
     where owner_user_id is null
       and (email_normalized = $2 or id = $3)
     returning id`,
    [input.userId, email, input.profileId],
  );

  // A stable upstream subject may return with a new verified email. Keep every
  // profile already linked to that user reachable through the email-scoped
  // applicant APIs without changing applicant-authored content timestamps.
  await client.query(
    `update applicant_profiles
     set email = $2, email_normalized = $2
     where owner_user_id = $1
       and (email <> $2 or email_normalized <> $2)`,
    [input.userId, email],
  );

  const owned = await client.query<{ id: string }>(
    `select id
     from applicant_profiles
     where owner_user_id = $1
       and email_normalized = $2
     order by updated_at desc, created_at desc, id asc
     limit 1`,
    [input.userId, email],
  );
  if (owned.rows[0]) {
    return {
      profileId: owned.rows[0].id,
      created: false,
      adoptedCount: adopted.rowCount || 0,
    };
  }

  await client.query(
    `insert into applicant_profiles (
       id, owner_user_id, full_name, email, email_normalized, visibility
     ) values ($1, $2, $3, $4, $4, 'private_store_application')`,
    [input.profileId, input.userId, fullName, email],
  );
  return { profileId: input.profileId, created: true, adoptedCount: 0 };
}
