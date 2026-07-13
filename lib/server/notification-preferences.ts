import { getApplicantProfile } from "@/lib/local-api-store";
import {
  getPostgresApplicantNotificationPrefs,
  updatePostgresApplicantNotificationPrefs,
} from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export type ApplicantNotificationPrefs = {
  invites: boolean;
  interviews: boolean;
  status: boolean;
  marketing: boolean;
  updatedAt?: string;
};

export type ApplicantNotificationCategory = keyof Pick<
  ApplicantNotificationPrefs,
  "invites" | "interviews" | "status" | "marketing"
>;

export const DEFAULT_APPLICANT_NOTIFICATION_PREFS: ApplicantNotificationPrefs = {
  invites: true,
  interviews: true,
  status: true,
  marketing: false,
};

const localPrefs = new Map<string, ApplicantNotificationPrefs>();

function emailKey(email?: string | null) {
  return email?.trim().toLowerCase() || "";
}

export async function getApplicantNotificationPrefs(
  email?: string | null,
): Promise<ApplicantNotificationPrefs | undefined> {
  const normalizedEmail = emailKey(email);
  if (!normalizedEmail) return undefined;

  if (getStorageRuntime() === "postgres") {
    return getPostgresApplicantNotificationPrefs(normalizedEmail);
  }

  if (!getApplicantProfile(normalizedEmail)) return undefined;
  return localPrefs.get(normalizedEmail) || DEFAULT_APPLICANT_NOTIFICATION_PREFS;
}

export async function updateApplicantNotificationPrefs(input: {
  email?: string | null;
  prefs: Partial<ApplicantNotificationPrefs>;
}): Promise<ApplicantNotificationPrefs | undefined> {
  const normalizedEmail = emailKey(input.email);
  if (!normalizedEmail) return undefined;

  if (getStorageRuntime() === "postgres") {
    return updatePostgresApplicantNotificationPrefs({
      email: normalizedEmail,
      prefs: input.prefs,
    });
  }

  if (!getApplicantProfile(normalizedEmail)) return undefined;
  const current = localPrefs.get(normalizedEmail) || DEFAULT_APPLICANT_NOTIFICATION_PREFS;
  const next = {
    ...current,
    ...input.prefs,
    updatedAt: new Date().toISOString(),
  };
  localPrefs.set(normalizedEmail, next);
  return next;
}

export async function applicantAllowsNotification(input: {
  email?: string | null;
  category: ApplicantNotificationCategory;
}) {
  const prefs = await getApplicantNotificationPrefs(input.email);
  // Non-applicant recipients (for example store managers receiving an assessment
  // completion message) do not have applicant preferences and stay eligible.
  return prefs ? prefs[input.category] : true;
}
