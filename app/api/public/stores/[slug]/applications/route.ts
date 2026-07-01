import { NextResponse } from "next/server";
import { listStoreUsers } from "@/lib/local-settings-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { notifyPublicApplicationSubmitted } from "@/lib/server/notifications";
import { createPostgresPublicApplication, getPostgresStoreManagerNotificationContact } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

async function managerNotificationContact(storeId: string) {
  if (getStorageRuntime() === "postgres") return getPostgresStoreManagerNotificationContact(storeId);
  const users = listStoreUsers(storeId);
  const manager = users.find((user) => user.status === "Active" && user.role === "Admin")
    || users.find((user) => user.status === "Active");
  return manager ? { name: manager.name, email: manager.email } : undefined;
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

  const candidateNotification = await notifyPublicApplicationSubmitted({
    toEmail: result.profile.email,
    recipientName: result.profile.fullName,
    recipientRole: "candidate",
    applicationId: result.applicationId,
    storeId: result.application.storeId,
    jobTitle: result.job.title,
    storeName: params.slug,
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
    storeName: params.slug,
  });

  return NextResponse.json({ ...result, notification: candidateNotification, candidateNotification, managerNotification }, { status: 201 });
});
