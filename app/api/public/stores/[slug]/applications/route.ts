import { createHash } from "node:crypto";
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
import { acceptsCurrentLegalTerms } from "@/lib/legal";
import { recordLegalConsent } from "@/lib/server/legal-consent";
import { validEmail } from "@/lib/server/request";
import { enforceRateLimit, rateLimit } from "@/lib/server/rate-limit";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_RESUME_BYTES + MAX_BODY_BYTES + 64 * 1024;
type ResumeAttachment = {
  originalFilename: string;
  mimeType: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  fileSizeBytes: number;
  sha256: string;
  content: Buffer;
};
const FIELD_LIMITS = {
  name: 120,
  email: 254,
  phone: 40,
  location: 120,
  headline: 180,
  summary: 4_000,
  skills: 5_000,
  experience: 8_000,
  education: 4_000,
} as const;

function field(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function tooLong(profile: Record<string, unknown>) {
  return Object.entries(FIELD_LIMITS).find(([key, limit]) => field(profile[key]).length > limit)?.[0];
}

function rateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: { code: "rate_limited", message: "Too many applications were submitted. Please wait a few minutes and try again." } },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

function requestError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function cleanFilename(value: string) {
  return value
    .normalize("NFKC")
    .split(/[\\/]/)
    .at(-1)!
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 180);
}

async function readApplicationRequest(request: Request): Promise<
  | { response: NextResponse }
  | { body: Record<string, unknown>; attachment?: ResumeAttachment }
> {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  const multipart = contentType.includes("multipart/form-data");
  if (!multipart && !contentType.includes("application/json")) {
    return { response: requestError("unsupported_media_type", "Application data must be sent as JSON or form data.", 415) };
  }
  const maxBytes = multipart ? MAX_MULTIPART_BYTES : MAX_BODY_BYTES;
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { response: requestError("payload_too_large", "The application or résumé is too large to submit.", 413) };
  }
  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.byteLength > maxBytes) {
    return { response: requestError("payload_too_large", "The application or résumé is too large to submit.", 413) };
  }

  let payloadText = "";
  let resumeFile: File | undefined;
  if (multipart) {
    const parsed = await new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body: raw }).formData().catch(() => null);
    const payload = parsed?.get("payload");
    const resume = parsed?.get("resume");
    if (typeof payload !== "string" || Buffer.byteLength(payload, "utf8") > MAX_BODY_BYTES) {
      return { response: requestError("invalid_form", "Application data could not be read.", 400) };
    }
    payloadText = payload;
    if (resume instanceof File && resume.size > 0) resumeFile = resume;
  } else {
    payloadText = raw.toString("utf8");
  }

  const body = (() => { try { return JSON.parse(payloadText); } catch { return null; } })();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { response: requestError("invalid_json", "Application data could not be read.", 400) };
  }
  if (!resumeFile) return { body };
  if (resumeFile.size > MAX_RESUME_BYTES) {
    return { response: requestError("resume_too_large", "Your résumé must be 5 MB or smaller.", 413) };
  }
  const originalFilename = cleanFilename(resumeFile.name);
  const extension = originalFilename.toLowerCase().endsWith(".pdf")
    ? "pdf"
    : originalFilename.toLowerCase().endsWith(".docx") ? "docx" : "";
  if (!extension) {
    return { response: requestError("invalid_resume_type", "Upload a PDF or DOCX résumé.", 400) };
  }
  const content = Buffer.from(await resumeFile.arrayBuffer());
  const isPdf = content.subarray(0, 5).toString("ascii") === "%PDF-";
  const zipHeader = content.subarray(0, 4).toString("hex");
  const isDocx = ["504b0304", "504b0506", "504b0708"].includes(zipHeader);
  if ((extension === "pdf" && !isPdf) || (extension === "docx" && !isDocx)) {
    return { response: requestError("invalid_resume_content", "That file does not appear to be a valid PDF or DOCX résumé.", 400) };
  }
  const mimeType: ResumeAttachment["mimeType"] = extension === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return {
    body,
    attachment: {
      originalFilename,
      mimeType,
      fileSizeBytes: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
      content,
    },
  };
}

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
  const ipLimited = await enforceRateLimit(request, "public-application", { limit: 12, windowSeconds: 900 });
  if (ipLimited) return ipLimited;
  const parsedRequest = await readApplicationRequest(request);
  if ("response" in parsedRequest) return parsedRequest.response;
  const { body, attachment } = parsedRequest;
  // Invisible honeypot: acknowledge automated submissions without creating
  // applicant data or teaching bots which field triggered the rejection.
  if (field(body.website)) return NextResponse.json({ accepted: true }, { status: 201 });
  const profile = body.profile && typeof body.profile === "object" ? body.profile as Record<string, unknown> : {};
  const applicantName = field(profile.name);
  const applicantEmail = field(profile.email).toLowerCase();
  if (!acceptsCurrentLegalTerms(body)) {
    return NextResponse.json({ error: "Accept the Privacy Policy and Terms of Service to continue." }, { status: 400 });
  }
  if (!applicantName || !validEmail(applicantEmail)) {
    return NextResponse.json({ error: "Applicant name and valid email are required" }, { status: 400 });
  }
  const oversizedField = tooLong(profile);
  if (oversizedField) {
    return NextResponse.json({ error: { code: "field_too_long", message: `${oversizedField} is too long.` } }, { status: 400 });
  }
  const jobId = field(body.jobId);
  if (!jobId || jobId.length > 160 || !/^[a-zA-Z0-9_-]+$/.test(jobId)) {
    return NextResponse.json({ error: { code: "invalid_job", message: "That job listing is not available." } }, { status: 400 });
  }
  const rawLocationPreference = body.locationPreference;
  const rawPreferredLocationIds = rawLocationPreference && typeof rawLocationPreference === "object" && !Array.isArray(rawLocationPreference)
    ? (rawLocationPreference as Record<string, unknown>).locationIds
    : [];
  if (Array.isArray(rawPreferredLocationIds) && rawPreferredLocationIds.length > 50) {
    return requestError("invalid_location_preference", "Choose no more than 50 preferred stores.", 400);
  }
  const preferredLocationIds = Array.isArray(rawPreferredLocationIds)
    ? [...new Set(rawPreferredLocationIds.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))]
    : [];
  if (preferredLocationIds.some((id) => id.length > 160 || !/^[a-zA-Z0-9_-]+$/.test(id))) {
    return requestError("invalid_location_preference", "One of the selected stores is not available.", 400);
  }
  const locationPreference = {
    scope: rawLocationPreference && typeof rawLocationPreference === "object" && !Array.isArray(rawLocationPreference)
      && (rawLocationPreference as Record<string, unknown>).scope === "selected" ? "selected" as const : "any" as const,
    locationIds: preferredLocationIds,
  };
  const emailBucket = createHash("sha256").update(applicantEmail).digest("hex").slice(0, 24);
  const emailLimited = await rateLimit(`public-application-email:${params.slug}:${emailBucket}`, 5, 3_600);
  if (!emailLimited.ok) return rateLimitResponse(emailLimited.retryAfterSeconds);
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() || "";
  if (idempotencyKey && (idempotencyKey.length < 16 || idempotencyKey.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(idempotencyKey))) {
    return NextResponse.json({ error: { code: "invalid_idempotency_key", message: "Refresh the page and try again." } }, { status: 400 });
  }
  const input = {
    storeSlug: params.slug,
    jobId,
    submissionKeyHash: idempotencyKey
      ? createHash("sha256").update(`${params.slug}:${idempotencyKey}`).digest("hex")
      : undefined,
    profile,
    attachment,
    locationPreference,
  };
  if (attachment && getStorageRuntime() !== "postgres") {
    return requestError("resume_storage_unavailable", "Résumé upload is temporarily unavailable. You can remove the file and submit the rest of your application.", 503);
  }
  const result =
    getStorageRuntime() === "postgres"
      ? await createPostgresPublicApplication(input)
      : getApplicantStore().createPublicApplication(input);

  if ("error" in result) {
    const message = result.error || "Unable to create application";
    return NextResponse.json({ error: message }, { status: message.includes("required") ? 400 : 404 });
  }
  if ("duplicate" in result) {
    return NextResponse.json({ applicationId: result.applicationId, duplicate: true }, { status: 200 });
  }
  await recordLegalConsent({
    email: applicantEmail,
    source: "public_application",
    context: {
      storeSlug: params.slug,
      jobId: result.application.jobId,
      applicationId: result.applicationId,
    },
  });
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
