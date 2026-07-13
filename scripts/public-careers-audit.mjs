#!/usr/bin/env node
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const files = {
  builder: read("app/(store)/public-page/page.tsx"),
  careers: read("app/careers/[slug]/page.tsx"),
  applyPage: read("app/careers/[slug]/apply/[jobId]/page.tsx"),
  renderer: read("components/PublicCareersView.tsx"),
  applyForm: read("components/PublicApplyForm.tsx"),
  applicationRoute: read("app/api/public/stores/[slug]/applications/route.ts"),
  eventRoute: read("app/api/public/stores/[slug]/events/route.ts"),
  tracker: read("components/PublicCareersTracker.tsx"),
  resumeRoute: read("app/api/applications/[id]/resume/route.ts"),
  publicStore: read("lib/server/postgres-phase1.ts"),
  previewToken: read("lib/server/public-preview-token.ts"),
  previewRoute: read("app/api/stores/[storeId]/public-page/preview/route.ts"),
  idempotencyMigration: read("db/migrations/0016_public_application_idempotency.sql"),
  attachmentMigration: read("db/migrations/0017_private_application_attachments.sql"),
  analyticsMigration: read("db/migrations/0018_public_careers_daily_events.sql"),
  dashboard: read("app/(store)/page.tsx"),
  jobList: read("app/(store)/jobs/page.tsx"),
  jobDetail: read("app/(store)/jobs/[slug]/page.tsx"),
  applicantDetail: read("app/(store)/applicants/[id]/page.tsx"),
};

let failures = 0;
function check(name, pass) {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
  if (!pass) failures += 1;
}

check("builder and published page share one careers renderer", files.builder.includes("<PublicCareersView") && files.careers.includes("<PublicCareersView"));
check("builder preview does not render demo jobs", !files.builder.includes("STORE_JOBS"));
check("public careers only resolves published pages for active stores", files.publicStore.includes("spp.status = 'published'") && files.publicStore.includes("s.status = 'active'"));
check("draft preview token is HMAC signed and expires", files.previewToken.includes("createHmac") && files.previewToken.includes("payload.exp * 1_000 <= Date.now()"));
check("draft preview is tied to store and slug", files.previewToken.includes("payload.slug !== expectedSlug") && files.previewRoute.includes("createPublicPreviewToken({ storeId"));
check("draft preview is noindex and cannot submit", files.careers.includes("index: false") && files.careers.includes("interactive={!snapshot.isPreview}"));
check("public applications have body and field limits", files.applicationRoute.includes("MAX_BODY_BYTES") && files.applicationRoute.includes("FIELD_LIMITS"));
check("public applications have IP and privacy-safe email throttles", files.applicationRoute.includes("enforceRateLimit(request, \"public-application\"") && files.applicationRoute.includes("public-application-email"));
check("public applications have a bot honeypot", files.applyForm.includes('name="website"') && files.applicationRoute.includes("body.website"));
check("mobile retries are idempotent", files.applyForm.includes('"idempotency-key"') && files.idempotencyMigration.includes("applications_public_submission_key_uidx"));
check("application errors are announced accessibly", files.applyForm.includes('role="alert"') && files.applyForm.includes('aria-live="polite"'));
check("mobile application uses a two-step essentials-first flow", files.applyForm.includes("Application step ${step} of 2") && files.applyForm.includes("Start with the essentials") && files.applyForm.includes("Review and send"));
check("mobile application draft is session-only and consent is not persisted", files.applyForm.includes("sessionStorage.setItem") && files.applyForm.includes("sessionStorage.removeItem") && !files.applyForm.includes("legalAccepted: legalAccepted"));
check("published careers and job pages expose canonical and structured data", files.careers.includes("alternates:") && files.careers.includes('application/ld+json') && files.applyPage.includes('"@type": "JobPosting"'));
check("resume attachments are private, capped, and content-validated", files.applicationRoute.includes("MAX_RESUME_BYTES") && files.applicationRoute.includes("invalid_resume_content") && files.attachmentMigration.includes("content bytea") && files.attachmentMigration.includes("5242880"));
check("resume downloads require store access and force safe attachment headers", files.resumeRoute.includes("requireLocationScopedStoreAccess") && files.resumeRoute.includes('Content-Disposition') && files.resumeRoute.includes('private, no-store') && files.resumeRoute.includes('Content-Security-Policy'));
check("careers funnel analytics stores only daily aggregate counts", files.analyticsMigration.includes("event_count") && !files.analyticsMigration.includes("ip_address") && !files.analyticsMigration.includes("user_agent"));
check("careers analytics is session-deduped and rate limited", files.tracker.includes("sessionStorage.getItem") && files.eventRoute.includes("public-careers-event") && files.eventRoute.includes("MAX_EVENT_BYTES"));
check("SSO store job detail waits for the authenticated store", files.jobDetail.includes('useActiveStoreId("")') && files.jobDetail.includes("if (!STORE_ID) return Promise.resolve()") && files.jobDetail.includes("setNotFound(false)"));
check("hiring managers can review submitted contact and background fields", files.applicantDetail.includes("body.profile?.phone") && files.applicantDetail.includes("body.resume?.skills") && files.applicantDetail.includes('title="Candidate background"'));
check("application receipt only claims email when delivery was sent", files.applyForm.includes('candidateNotification?.status === "sent"') && files.applyForm.includes("The hiring team will contact you at the email address you provided"));
check("dashboard activity rows have unique composite keys", !files.dashboard.includes("key={a.text}") && files.dashboard.includes("a.href") && files.dashboard.includes("index}`"));
check("job analytics labels distinguish apply-page views from submissions", files.jobList.includes("apply-page view") && files.jobList.includes("submission") && files.jobDetail.includes("Apply-page views → submissions"));

process.exitCode = failures ? 1 : 0;
