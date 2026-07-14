import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { LEGAL_POLICY_VERSION, PRIVACY_POLICY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { getPostgresPool } from "@/lib/server/postgres";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

type LegalConsentSource = "public_application" | "applicant_signup" | "store_signup";

type LegalConsentRecord = {
  id: string;
  email: string;
  source: LegalConsentSource;
  acceptedAt: string;
  context: Record<string, string>;
};

type LegalConsentInput = {
  email: string;
  source: LegalConsentSource;
  context?: Record<string, string | null | undefined>;
};

const localConsents: LegalConsentRecord[] = [];

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function cleanContext(context?: Record<string, string | null | undefined>) {
  return Object.fromEntries(
    Object.entries(context || {}).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

function buildLegalConsentRecord(input: LegalConsentInput): LegalConsentRecord {
  return {
    id: `consent-${randomUUID()}`,
    email: normalizeEmail(input.email),
    source: input.source,
    acceptedAt: new Date().toISOString(),
    context: cleanContext(input.context),
  };
}

async function insertPostgresLegalConsent(client: Pick<PoolClient, "query">, record: LegalConsentRecord) {
  await client.query(
    `
      insert into legal_consents (
        id, email_normalized, source, policy_version, privacy_version,
        terms_version, accepted_at, context
      )
      values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::jsonb)
    `,
    [
      record.id,
      record.email,
      record.source,
      LEGAL_POLICY_VERSION,
      PRIVACY_POLICY_VERSION,
      TERMS_VERSION,
      record.acceptedAt,
      JSON.stringify(record.context),
    ],
  );
}

export async function recordLegalConsent(input: LegalConsentInput) {
  const record = buildLegalConsentRecord(input);

  if (getStorageRuntime() !== "postgres") {
    localConsents.push(record);
    return record;
  }

  await insertPostgresLegalConsent(getPostgresPool(), record);
  return record;
}

// Account creation and its legal evidence must commit together. Callers that
// already hold a transaction use this helper so a later credential/profile
// failure cannot leave consent recorded for an account that was never created.
export async function recordLegalConsentInTransaction(client: PoolClient, input: LegalConsentInput) {
  const record = buildLegalConsentRecord(input);
  await insertPostgresLegalConsent(client, record);
  return record;
}
