# JewelHire v2 QA Feature Matrix

Date: 2026-06-24

Legend: `API` = API smoke covered, `Browser` = browser smoke covered, `Manual` = needs human visual/product pass, `Pending` = production integration remains.

| Surface | Feature | Status | Coverage |
|---|---|---|---|
| Public | Store careers/apply route | Browser smoke | Browser route + public apply flow |
| Public | Public job detail | API + Browser smoke | Public route/API reads |
| Public | Application submit | API + Browser smoke | Browser apply + API mutation smoke |
| Applicant | Portal home/applications | API + Browser smoke | Browser routes + API reads |
| Applicant | Invites/GemMatch | API + Browser smoke | Browser route + API GemMatch completion |
| Applicant | Interviews/RSVP | API + Browser smoke | Browser route + API RSVP |
| Applicant | Resume builder | API + Browser smoke | Browser edit + API save/export/template |
| Applicant | Training/course progress | API + Browser smoke | Browser route + API progress/credentials/course-test attempt |
| Applicant | Profile/notification prefs | API smoke | API profile/prefs mutations |
| Store | Dashboard | API + Browser smoke | Browser route + API reads |
| Store | Pipeline | API + Browser smoke | Browser route + API reads/stage mutation |
| Store | Applicant CRM/detail/notes | API + Browser smoke | Browser routes + API notes |
| Store | JewelCert send/results | API + Browser smoke | Browser routes + API invite/result reads |
| Store | GemMatch send/results | API + Browser smoke | Browser route + API GemMatch completion |
| Store | Interviews | API + Browser smoke | Existing-app scheduling, new-candidate scheduling, soft-cancel, RSVP |
| Store | Jobs | API + Browser smoke | Browser route + API create/edit/open/pause/close |
| Store | Role templates | API smoke | Read/patch local contract; production persistence pending |
| Store | Training/course assignments | API + Browser smoke | Browser route + API assign/progress |
| Store | Team/roster/composition | API + Browser smoke | Browser routes + API reads |
| Store | Public-page builder/reviews | API + Browser smoke | Browser route + API config save, logo, testimonial, preview, publish, review mutations |
| Store | Settings/users/integrations | API + Browser smoke | Browser route + API users/settings/invite settings/integration connect-disconnect |
| Store | Hire-to-JewelLink handoff | API smoke | Preview/confirm/sync local behavior; real JewelLink write pending |
| Admin | Overview/analytics/support | API + Browser smoke | Browser routes + API reads |
| Admin | Companies/users/impersonation | API + Browser smoke | Browser company create + API user invite/resend/status/remove/impersonation mutations |
| Admin | Billing | API + Browser smoke | Read-only plans/invoices; provider mutations pending |
| Admin | Assessments | API + Browser smoke | Browser route + API reads |
| Security | Store privacy | API + Browser smoke | Browser-context API checks for Sissy's/Harbor |
| Security | Auth/session | Pending | JewelLink SSO and role gates pending |
| Media | Public/course media storage | Pending | Real object storage pending |
| Documents | Resume PDF export | Pending | Placeholder contract exists; real PDF service pending |

## Latest Automated Coverage

2026-06-24 local and Postgres browser QA passed across:

- Store owner routes on desktop and mobile: dashboard, pipeline, applicants, applicant detail,
  jobs, job detail, interviews, JewelCert send, cert invitations, GemMatch, team, team map, roster,
  training, course detail, assessments, public-page builder, and settings.
- Applicant routes on desktop and mobile: apply, portal home, applications, invites, interviews,
  resume, training, and profile.
- Admin routes on desktop and mobile: overview, companies, company detail, billing, assessments,
  support, and analytics.
- Scripted flows: public application submit, store new-candidate interview schedule, applicant
  resume edit plus training page, and admin company create.
- Expanded workflow API checks inside browser QA: store pipeline search visibility, applicant
  note create/list/delete, JewelCert invite creation, application stage movement, interview RSVP,
  hire preview/confirm/sync detail, course-test attempt, custom assessment publish/unpublish,
  public-page config/logo/testimonial/preview/publish/review mutations, store settings/user/integration
  mutations, admin user invite/resend/status/remove, and admin impersonation.

The Postgres browser pass also covered the staged privacy check: Sissy's can read Sissy's
applicants, while Harbor receives `403` for the Sissy's store-scoped route. The remaining QA gap is
not automated route health; it is a headed/manual product pass for visual polish, role clarity, and
workflow wording.

## Latest Role Product QA

2026-06-25 read-only browser QA captured representative role screenshots in
`docs/qa-runs/role-product-qa-2026-06-25T01-03-26-819Z`.

- Checked 15 Applicant/Associate, Store Owner, and Admin pages against the Postgres-backed dev app
  at `http://localhost:3004`; every sampled route returned 200 and rendered non-empty body text.
- No generated smoke text was visible in sampled Applicant, Store Owner, or Admin pages after the
  staging cleanup work.
- Completed follow-up: applicant-detail candidate rating UI and local applicant-profile rating data
  were removed so Phase 1 keeps candidate ratings/reviews out of the product.
- Completed follow-up: Claude added a mobile card layout for `/pipeline` while preserving the desktop
  table. Targeted mobile/frontend QA passed under
  `docs/qa-runs/frontend-polish-after-mobile-pipeline-2026-06-25`, and the strict rerun passed under
  `docs/qa-runs/frontend-polish-after-mobile-pipeline-strict-2026-06-25`.
- Completed follow-up: the mobile apply stepper still shows the `Review` label at 390px, and the
  targeted hydration checks did not reproduce the earlier warnings on `/pipeline`,
  `/applicants/maya-chen`, or `/public-page`.
- Completed follow-up: the app Postgres pool connection timeout default is now 15 seconds via
  `POSTGRES_CONNECTION_TIMEOUT_MS`, reducing local QA cold-connection flakes without adding unsafe
  mutation retries.
- Remaining QA gap: headed/manual product review across Applicant/Associate, Store Owner, and Admin
  for final wording, role clarity, and visual polish. Automated route health, core API behavior,
  Postgres staging smoke, mobile pipeline overflow, candidate-rating guardrail, and targeted
  hydration checks are currently green.
