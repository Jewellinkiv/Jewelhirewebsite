type NotificationTemplate =
  | "public_application_confirmation"
  | "assessment_completed"
  | "billing_changed"
  | "team_user_invited"
  | "training_assignment"
  | "jewelcert_invite"
  | "interview_scheduled";

type NotificationRecipient = {
  email?: string | null;
  name?: string | null;
};

type SendNotificationInput = {
  template: NotificationTemplate;
  to: NotificationRecipient;
  subject: string;
  textBody: string;
  htmlBody?: string;
  tag?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

type NotificationResult = {
  status: "disabled" | "dry_run" | "sent" | "skipped" | "failed";
  provider: "postmark";
  reason?: string;
};

const POSTMARK_API_URL = "https://api.postmarkapp.com/email";

function emailNotificationsEnabled() {
  return process.env.EMAIL_NOTIFICATIONS_ENABLED === "true";
}

function postmarkDryRunEnabled() {
  return process.env.POSTMARK_DRY_RUN === "1" || process.env.POSTMARK_DRY_RUN === "true";
}

function postmarkServerToken() {
  return process.env.POSTMARK_SERVER_TOKEN?.trim() || "";
}

function postmarkFromEmail() {
  return process.env.POSTMARK_FROM_EMAIL?.trim() || "notifications@jewelhire.com";
}

function postmarkMessageStream() {
  return process.env.POSTMARK_MESSAGE_STREAM?.trim() || "outbound";
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://app.jewelhire.com").replace(/\/$/, "");
}

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || "";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function bodyToHtml(textBody: string) {
  return textBody
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function scrubMetadata(metadata: SendNotificationInput["metadata"]) {
  if (!metadata) return undefined;
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)]),
  );
}

export function notificationRuntimeStatus() {
  return {
    enabled: emailNotificationsEnabled(),
    dryRun: postmarkDryRunEnabled(),
    providerConfigured: Boolean(postmarkServerToken()),
    provider: "postmark" as const,
  };
}

export async function sendNotification(input: SendNotificationInput): Promise<NotificationResult> {
  const toEmail = normalizeEmail(input.to.email);
  if (!toEmail || !toEmail.includes("@")) {
    return { status: "skipped", provider: "postmark", reason: "missing_recipient" };
  }

  const runtime = notificationRuntimeStatus();
  if (!runtime.enabled) {
    return { status: "disabled", provider: "postmark", reason: "EMAIL_NOTIFICATIONS_ENABLED is not true" };
  }
  if (runtime.dryRun) {
    return { status: "dry_run", provider: "postmark" };
  }

  const token = postmarkServerToken();
  if (!token) {
    return { status: "failed", provider: "postmark", reason: "postmark_not_configured" };
  }

  const response = await fetch(POSTMARK_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: postmarkFromEmail(),
      To: toEmail,
      Subject: input.subject,
      TextBody: input.textBody,
      HtmlBody: input.htmlBody || bodyToHtml(input.textBody),
      MessageStream: postmarkMessageStream(),
      Tag: input.tag || input.template,
      Metadata: scrubMetadata(input.metadata),
    }),
  });

  if (!response.ok) {
    return { status: "failed", provider: "postmark", reason: `postmark_${response.status}` };
  }
  return { status: "sent", provider: "postmark" };
}

export async function notifyJewelCertInviteCreated(input: {
  toEmail?: string | null;
  recipientName?: string | null;
  inviteId: string;
  applicationId: string;
  storeId: string;
  itemCount: number;
}) {
  const countLabel = `${input.itemCount || 1} item${input.itemCount === 1 ? "" : "s"}`;
  const link = `${appUrl()}/portal/invites`;
  const name = input.recipientName?.trim() || "there";
  return sendNotification({
    template: "jewelcert_invite",
    to: { email: input.toEmail, name },
    subject: "Your JewelHire assessment invite",
    textBody: [
      `Hi ${name},`,
      `You have a JewelHire assessment package ready with ${countLabel} to complete.`,
      `Open your invite here: ${link}`,
    ].join("\n\n"),
    tag: "jewelcert-invite",
    metadata: {
      inviteId: input.inviteId,
      applicationId: input.applicationId,
      storeId: input.storeId,
      itemCount: input.itemCount,
    },
  });
}

export async function notifyPublicApplicationSubmitted(input: {
  toEmail?: string | null;
  recipientName?: string | null;
  recipientRole?: "candidate" | "manager";
  applicationId: string;
  storeId: string;
  candidateName?: string | null;
  jobTitle?: string | null;
  storeName?: string | null;
}) {
  const recipientRole = input.recipientRole || "candidate";
  const link = recipientRole === "manager" ? `${appUrl()}/applicants` : `${appUrl()}/portal/applications`;
  const name = input.recipientName?.trim() || "there";
  const role = input.jobTitle?.trim() || "the role";
  const storeName = input.storeName?.trim() || "the store";
  const candidateName = input.candidateName?.trim() || "A candidate";
  const subject =
    recipientRole === "manager"
      ? `New JewelHire application for ${role}`
      : `JewelHire application received for ${role}`;
  const body =
    recipientRole === "manager"
      ? [
          `Hi ${name},`,
          `${candidateName} applied for ${role} at ${storeName}.`,
          `Review the application here: ${link}`,
        ]
      : [
          `Hi ${name},`,
          `Your JewelHire application for ${role} at ${storeName} was received.`,
          `You can view your application status here: ${link}`,
        ];

  return sendNotification({
    template: "public_application_confirmation",
    to: { email: input.toEmail, name },
    subject,
    textBody: body.join("\n\n"),
    tag: recipientRole === "manager" ? "application-submitted-manager" : "application-submitted",
    metadata: {
      applicationId: input.applicationId,
      storeId: input.storeId,
      jobTitle: input.jobTitle,
      recipientRole,
    },
  });
}

export async function notifyAssessmentCompleted(input: {
  toEmail?: string | null;
  recipientName?: string | null;
  recipientRole: "candidate" | "manager";
  applicationId: string;
  storeId: string;
  candidateName?: string | null;
  jobTitle?: string | null;
  resultLabel?: string | null;
}) {
  const candidateName = input.candidateName?.trim() || "A candidate";
  const role = input.jobTitle?.trim() || "the role";
  const result = input.resultLabel?.trim() || "GemMatch";
  const name = input.recipientName?.trim() || "there";
  const link = input.recipientRole === "candidate" ? `${appUrl()}/portal/invites` : `${appUrl()}/applicants`;
  const subject =
    input.recipientRole === "candidate"
      ? `Your ${result} is complete`
      : `${candidateName} completed ${result}`;
  const body =
    input.recipientRole === "candidate"
      ? [
          `Hi ${name},`,
          `Your ${result} for ${role} is complete.`,
          `You can view your invite status here: ${link}`,
        ]
      : [
          `Hi ${name},`,
          `${candidateName} completed ${result} for ${role}.`,
          `Review candidate results here: ${link}`,
        ];

  return sendNotification({
    template: "assessment_completed",
    to: { email: input.toEmail, name },
    subject,
    textBody: body.join("\n\n"),
    tag: "assessment-completed",
    metadata: {
      applicationId: input.applicationId,
      storeId: input.storeId,
      recipientRole: input.recipientRole,
      resultLabel: result,
    },
  });
}

export async function notifyTeamUserInvited(input: {
  toEmail?: string | null;
  recipientName?: string | null;
  role?: string | null;
  organizationName?: string | null;
  scope: "store" | "company";
  storeId?: string | null;
  companyId?: string | null;
  resent?: boolean;
}) {
  const name = input.recipientName?.trim() || "there";
  const role = input.role?.trim() || "team member";
  const organization = input.organizationName?.trim() || "JewelHire";
  const link = `${appUrl()}/login`;
  return sendNotification({
    template: "team_user_invited",
    to: { email: input.toEmail, name },
    subject: input.resent ? `Your JewelHire invite to ${organization}` : `You are invited to JewelHire for ${organization}`,
    textBody: [
      `Hi ${name},`,
      `You have been invited as ${role} for ${organization}.`,
      `Sign in here to get started: ${link}`,
    ].join("\n\n"),
    tag: input.resent ? "team-user-invite-resent" : "team-user-invited",
    metadata: {
      scope: input.scope,
      storeId: input.storeId,
      companyId: input.companyId,
      role,
      resent: input.resent || false,
    },
  });
}

export async function notifyBillingChanged(input: {
  toEmail?: string | null;
  recipientName?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  eventType: string;
  target?: string | null;
  status?: string | null;
  amountCents?: number | null;
  providerObjectId?: string | null;
}) {
  const name = input.recipientName?.trim() || "there";
  const companyName = input.companyName?.trim() || "your company";
  const status = input.status?.trim() || "updated";
  const target = input.target?.trim() || "billing";
  const amount =
    Number.isFinite(input.amountCents) && input.amountCents != null
      ? `Amount: ${(input.amountCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}`
      : "";
  const link = `${appUrl()}/settings`;
  const subject =
    input.eventType === "invoice.payment_failed"
      ? `Billing attention needed for ${companyName}`
      : `Billing updated for ${companyName}`;

  return sendNotification({
    template: "billing_changed",
    to: { email: input.toEmail, name },
    subject,
    textBody: [
      `Hi ${name},`,
      `Stripe reported a ${target} event for ${companyName}.`,
      `Status: ${status}`,
      amount,
      `Review billing here: ${link}`,
    ].filter(Boolean).join("\n\n"),
    tag: input.eventType === "invoice.payment_failed" ? "billing-payment-failed" : "billing-changed",
    metadata: {
      companyId: input.companyId,
      eventType: input.eventType,
      target,
      status,
      providerObjectId: input.providerObjectId,
    },
  });
}

export async function notifyTrainingAssignment(input: {
  toEmail?: string | null;
  recipientName?: string | null;
  recipientRole?: "learner" | "manager";
  event: "assigned" | "completed" | "overdue";
  assignmentId: string;
  storeId?: string | null;
  courseTitle?: string | null;
  packageName?: string | null;
  dueAt?: string | null;
}) {
  const name = input.recipientName?.trim() || "there";
  const courseTitle = input.courseTitle?.trim() || "your training";
  const packageName = input.packageName?.trim() || "training";
  const recipientRole = input.recipientRole || "learner";
  const link = recipientRole === "manager" ? `${appUrl()}/learn` : `${appUrl()}/portal/training`;
  const dueLine = input.dueAt ? `Due: ${input.dueAt}` : "";
  const eventText =
    input.event === "assigned"
      ? `${courseTitle} has been assigned as part of ${packageName}.`
      : input.event === "completed"
        ? `${courseTitle} has been completed.`
        : `${courseTitle} is overdue.`;
  const subject =
    input.event === "assigned"
      ? `Training assigned: ${courseTitle}`
      : input.event === "completed"
        ? `Training completed: ${courseTitle}`
        : `Training overdue: ${courseTitle}`;

  return sendNotification({
    template: "training_assignment",
    to: { email: input.toEmail, name },
    subject,
    textBody: [
      `Hi ${name},`,
      eventText,
      dueLine,
      `Open training here: ${link}`,
    ].filter(Boolean).join("\n\n"),
    tag: `training-${input.event}`,
    metadata: {
      assignmentId: input.assignmentId,
      storeId: input.storeId,
      event: input.event,
      recipientRole,
    },
  });
}

export async function notifyInterviewScheduled(input: {
  toEmail?: string | null;
  recipientName?: string | null;
  interviewId: string;
  applicationId: string;
  storeId: string;
  startsAt?: string | null;
  locationDetails?: string | null;
}) {
  const link = `${appUrl()}/portal/interviews`;
  const name = input.recipientName?.trim() || "there";
  const when = input.startsAt ? ` for ${input.startsAt}` : "";
  const where = input.locationDetails ? `Location: ${input.locationDetails}` : "";
  return sendNotification({
    template: "interview_scheduled",
    to: { email: input.toEmail, name },
    subject: "Your JewelHire interview is scheduled",
    textBody: [
      `Hi ${name},`,
      `Your JewelHire interview has been scheduled${when}.`,
      where,
      `View interview details here: ${link}`,
    ].filter(Boolean).join("\n\n"),
    tag: "interview-scheduled",
    metadata: {
      interviewId: input.interviewId,
      applicationId: input.applicationId,
      storeId: input.storeId,
    },
  });
}
