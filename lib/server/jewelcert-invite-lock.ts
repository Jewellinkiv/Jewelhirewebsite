import type { PoolClient } from "pg";

const INVITE_LOCK_NAMESPACE = "jewelcert-invite:v1:";

// Every transaction that can mutate both an applicant profile and a JewelCert
// invite takes this lock before touching either row family. A shared helper
// keeps the integration resend and native-claim paths on one lock namespace.
export async function acquireJewelCertInviteTransactionLock(
  client: Pick<PoolClient, "query">,
  inviteId: string,
) {
  const normalizedInviteId = inviteId.trim();
  if (!normalizedInviteId || normalizedInviteId.length > 512) {
    throw new Error("A valid JewelCert invite id is required for locking.");
  }
  await client.query(
    "select pg_advisory_xact_lock(hashtextextended($1, 0))",
    [`${INVITE_LOCK_NAMESPACE}${normalizedInviteId}`],
  );
}
