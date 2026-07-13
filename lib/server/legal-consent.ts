import { randomUUID } from "node:crypto";
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

const localConsents: LegalConsentRecord[] = [];

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function cleanContext(context?: Record<string, string | null | undefined>) {
  return Object.fromEntries(
    Object.entries(context || {}).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

export async function recordLegalConsent(input: {
  email: string;
  source: LegalConsentSource;
  context?: Record<string, string | null | undefined>;
}) {
  const record: LegalConsentRecord = {
    id: `consent-${randomUUID()}`,
    email: normalizeEmail(input.email),
    source: input.source,
    acceptedAt: new Date().toISOString(),
    context: cleanContext(input.context),
  };

  if (getStorageRuntime() !== "postgres") {
    localConsents.push(record);
    return record;
  }

  await getPostgresPool().query(
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
  return record;
}
