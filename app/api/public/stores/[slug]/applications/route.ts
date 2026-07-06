import { NextResponse } from "next/server";
import { getStoreSettings, listStoreUsers } from "@/lib/local-settings-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { notifyPublicApplicationSubmitted } from "@/lib/server/notifications";
import {
  createPostgresPublicApplication,
  getPostgresStoreManagerNotificationContact,
  getPostgresStoreSettings,
} from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { incrementLocalJobApplyClick } from "@/lib/local-job-store";

async function managerNotificationContact(storeId: string) {
  if (getStorageRuntime() === "postgres") return getPostgresStoreManagerNotificationContact(storeId);
  const users = listStoreUsers(storeId);
  const manager = users.find((user) => user.status === "Active" && user.role === "Admin")
    || users.find((user) => user.status === "Active");
  return manager ? { name: manager.name, email: manager.email } : undefined;
}

// Resolve the store's human-readable name for outbound emails so candidates/managers
// see e.g. "Sissy's Log Cabin", not the URL slug ("sissys-log-cabin-careers").
async function storeDisplayName(storeId: string) {
  const settings = getStorageRuntime() === "postgres"
    ? await getPostgresStoreSettings(storeId)
    : getStoreSettings(storeId);
  return settings.organization.company?.trim() || undefined;
}

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const input = {
    storeSlug: params.slug,
    jobId: body?.jobId,
    profile: body?.profile || {},
  };
  const result =
    getStorageRuntime() === "postgres"
      ? await createPostgresPublicApplication(input)
      : getApplicantStore().createPublicApplication(input);

  if ("error" in result) {
    const message = result.error || "Unable to create application";
    return NextResponse.json({ error: message }, { status: message.includes("required") ? 400 : 404 });
  }
  if (getStorageRuntime() !== "postgres") {
    incrementLocalJobApplyClick(result.application.storeId, result.application.jobId);
  }

  const storeName = (await storeDisplayName(result.application.storeId)) || params.slug;
  const candidateNotification = await notifyPublicApplicationSubmitted({
    toEmail: result.profile.email,
    recipientName: result.profile.fullName,
    recipientRole: "candidate",
    applicationId: result.applicationId,
    storeId: result.application.storeId,
    jobTitle: result.job.title,
    storeName,
  });
  const manager = await managerNotificationContact(result.application.storeId);
  const managerNotification = await notifyPublicApplicationSubmitted({
    toEmail: manager?.email,
    recipientName: manager?.name,
    recipientRole: "manager",
    applicationId: result.applicationId,
    storeId: result.application.storeId,
    candidateName: result.profile.fullName,
    jobTitle: result.job.title,
    storeName,
  });

  return NextResponse.json({ ...result, notification: candidateNotification, candidateNotification, managerNotification }, { status: 201 });
});
