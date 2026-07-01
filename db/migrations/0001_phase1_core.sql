-- JewelHire v2 Phase 1 core schema draft.
-- Status: reviewed migration artifact only. Do not apply to production until
-- credentials are rotated, backup/rollback process is defined, and adapter smoke
-- tests are ready.

create table if not exists companies (
  id text primary key,
  name text not null,
  owner_name text,
  plan_tier text not null default 'starter',
  status text not null default 'active' check (status in ('active', 'trialing', 'paused', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stores (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  name text not null,
  slug text not null unique,
  location_label text,
  timezone text not null default 'America/New_York',
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stores_company_id_idx on stores(company_id);

create table if not exists users (
  id text primary key,
  company_id text references companies(id) on delete set null,
  email text not null,
  email_normalized text not null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'invited', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email_normalized)
);

create index if not exists users_company_id_idx on users(company_id);

create table if not exists store_users (
  id text primary key,
  store_id text not null references stores(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null check (role in ('admin', 'store_owner', 'manager', 'supervisor')),
  status text not null default 'active' check (status in ('active', 'invited', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, user_id)
);

create index if not exists store_users_user_id_idx on store_users(user_id);

create table if not exists store_settings (
  store_id text primary key references stores(id) on delete cascade,
  organization_company text not null default '',
  organization_primary_store text not null default '',
  default_manager text not null default '',
  workflow jsonb not null default '[]'::jsonb,
  notifications jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists store_invite_settings (
  store_id text primary key references stores(id) on delete cascade,
  calendar_provider text check (calendar_provider in ('google', 'microsoft')),
  account text not null default '',
  from_name text not null default '',
  reply_to text not null default '',
  timezone text not null default 'America/New_York',
  default_duration text not null default '45 min',
  location text not null default '',
  add_links boolean not null default true,
  attach_ics boolean not null default true,
  remind24 boolean not null default true,
  remind1 boolean not null default false,
  note_template text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists store_integrations (
  id text primary key,
  store_id text not null references stores(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  account text not null default '',
  status text not null default 'disconnected' check (status in ('connected', 'disconnected')),
  scopes jsonb not null default '[]'::jsonb,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, provider)
);

create index if not exists store_integrations_store_status_idx on store_integrations(store_id, status);

create table if not exists external_identities (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  provider text not null,
  provider_subject text not null,
  email_at_login text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_subject)
);

create table if not exists applicant_profiles (
  id text primary key,
  owner_user_id text references users(id) on delete set null,
  full_name text not null,
  email text not null,
  email_normalized text not null,
  phone text,
  location text,
  resume_headline text,
  summary text,
  visibility text not null default 'private_store_application' check (visibility = 'private_store_application'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applicant_profiles_email_idx on applicant_profiles(email_normalized);
create index if not exists applicant_profiles_name_idx on applicant_profiles(full_name);

create table if not exists applicant_resumes (
  id text primary key,
  applicant_profile_id text not null references applicant_profiles(id) on delete cascade,
  summary text,
  work_experience jsonb not null default '[]'::jsonb,
  education jsonb not null default '[]'::jsonb,
  skills jsonb not null default '[]'::jsonb,
  portfolio_links jsonb not null default '[]'::jsonb,
  course_credential_ids jsonb not null default '[]'::jsonb,
  template_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (applicant_profile_id)
);

create table if not exists store_public_pages (
  id text primary key,
  store_id text not null references stores(id) on delete cascade,
  slug text not null unique,
  template_id text,
  logo_text text,
  logo_asset_id text,
  theme jsonb not null default '{}'::jsonb,
  job_layout text not null default 'cards',
  headline text not null,
  about text,
  benefits jsonb not null default '[]'::jsonb,
  hours jsonb not null default '[]'::jsonb,
  review_summary jsonb not null default '{"rating":0,"count":0}'::jsonb,
  show_reviews boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists store_public_pages_store_id_idx on store_public_pages(store_id);

create table if not exists public_page_assets (
  id text primary key,
  store_id text not null references stores(id) on delete cascade,
  public_page_id text references store_public_pages(id) on delete cascade,
  usage_context text not null check (usage_context in ('logo', 'hero', 'gallery')),
  original_filename text not null,
  mime_type text not null,
  file_size_bytes integer not null default 0,
  storage_url text not null,
  alt_text text not null default '',
  source text not null default 'local_placeholder' check (source in ('local_placeholder', 'uploaded', 'external_url')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists public_page_assets_page_context_idx on public_page_assets(public_page_id, usage_context);

create table if not exists public_page_testimonials (
  id text primary key,
  store_id text not null references stores(id) on delete cascade,
  public_page_id text references store_public_pages(id) on delete cascade,
  name text not null,
  rating integer not null default 5 check (rating between 1 and 5),
  text text not null,
  source text not null default 'manual' check (source in ('customer', 'employee', 'manual', 'imported')),
  status text not null default 'published' check (status in ('draft', 'published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists public_page_testimonials_page_status_idx on public_page_testimonials(public_page_id, status);

create table if not exists public_page_reviews (
  id text primary key,
  store_id text not null references stores(id) on delete cascade,
  name text not null,
  rating integer not null default 5 check (rating between 1 and 5),
  text text not null,
  when_label text not null default '',
  source text not null default 'store_seed' check (source in ('store_seed', 'google', 'manual')),
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists public_page_reviews_store_status_idx on public_page_reviews(store_id, status);

create table if not exists public_page_previews (
  id text primary key,
  store_id text not null references stores(id) on delete cascade,
  public_page_id text references store_public_pages(id) on delete cascade,
  generated_at timestamptz not null default now(),
  status text not null check (status in ('draft', 'published', 'paused')),
  preview_url text not null,
  snapshot jsonb not null default '{}'::jsonb
);

create index if not exists public_page_previews_store_generated_idx on public_page_previews(store_id, generated_at desc);

create table if not exists public_jobs (
  id text primary key,
  store_id text not null references stores(id) on delete cascade,
  public_page_id text references store_public_pages(id) on delete set null,
  slug text not null,
  title text not null,
  location text,
  employment_type text,
  compensation_summary text,
  description text,
  requirements jsonb not null default '[]'::jsonb,
  ideal_gemmatch_mix jsonb not null default '[]'::jsonb,
  required_assessment_ids jsonb not null default '[]'::jsonb,
  required_course_ids jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'open', 'paused', 'closed')),
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);

create index if not exists public_jobs_store_status_idx on public_jobs(store_id, status);

create table if not exists applications (
  id text primary key,
  store_id text not null references stores(id) on delete cascade,
  job_id text references public_jobs(id) on delete set null,
  applicant_profile_id text not null references applicant_profiles(id) on delete cascade,
  source text not null check (source in ('public_store_page', 'manual_store_entry', 'referral', 'admin_import')),
  stage text not null default 'applied' check (stage in ('applied', 'jewelcert', 'gemmatch', 'interview', 'offer', 'hired', 'rejected', 'withdrawn')),
  status_reason text,
  current_owner_user_id text references users(id) on delete set null,
  submitted_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applications_store_stage_activity_idx on applications(store_id, stage, last_activity_at desc);
create index if not exists applications_store_job_idx on applications(store_id, job_id);
create index if not exists applications_profile_idx on applications(applicant_profile_id);

create table if not exists application_stage_events (
  id text primary key,
  application_id text not null references applications(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  actor_user_id text references users(id) on delete set null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists application_stage_events_application_created_idx on application_stage_events(application_id, created_at desc);
create index if not exists application_stage_events_store_created_idx on application_stage_events(store_id, created_at desc);

create table if not exists applicant_notes (
  id text primary key,
  application_id text not null references applications(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  author_user_id text references users(id) on delete set null,
  body text not null,
  visibility text not null default 'store_internal' check (visibility = 'store_internal'),
  note_type text not null default 'general' check (note_type in ('general', 'screening', 'interview', 'hire_handoff')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applicant_notes_application_created_idx on applicant_notes(application_id, created_at desc);
create index if not exists applicant_notes_store_created_idx on applicant_notes(store_id, created_at desc);

create table if not exists assessments (
  id text primary key,
  store_id text references stores(id) on delete cascade,
  owner text not null check (owner in ('admin', 'store')),
  title text not null,
  description text not null default '',
  kind text not null check (kind in ('Knowledge check', 'Trait profile', 'Skills check')),
  status text not null default 'Draft' check (status in ('Draft', 'Published')),
  targets jsonb not null default '[]'::jsonb,
  media jsonb not null default '[]'::jsonb,
  question_count integer not null default 0,
  duration_minutes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assessments_store_status_updated_idx on assessments(store_id, status, updated_at desc);

create table if not exists assessment_questions (
  id text primary key,
  assessment_id text not null references assessments(id) on delete cascade,
  question_type text not null check (question_type in ('multiple-choice', 'scale', 'short-answer')),
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  answer_index integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assessment_questions_assessment_sort_idx on assessment_questions(assessment_id, sort_order);

create table if not exists assessment_results (
  id text primary key,
  store_id text not null references stores(id) on delete cascade,
  application_id text references applications(id) on delete cascade,
  assessment_id text references assessments(id) on delete set null,
  slug text not null,
  title text not null,
  result_type text not null check (result_type in ('knowledge_check', 'trait_profile')),
  candidate jsonb not null default '{}'::jsonb,
  completed_at text not null,
  duration_minutes integer not null default 0,
  status text not null check (status in ('Needs review', 'Reviewed')),
  total_score integer not null default 0,
  score_label text not null default '',
  summary text not null default '',
  categories jsonb not null default '[]'::jsonb,
  traits jsonb not null default '[]'::jsonb,
  answer_review jsonb not null default '[]'::jsonb,
  recommendation jsonb not null default '{}'::jsonb,
  follow_ups jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);

create index if not exists assessment_results_store_status_updated_idx on assessment_results(store_id, status, updated_at desc);
create index if not exists assessment_results_application_idx on assessment_results(application_id);

create table if not exists jewelcert_decisions (
  id text primary key,
  application_id text not null references applications(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  actor_user_id text references users(id) on delete set null,
  decision text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists jewelcert_decisions_application_created_idx on jewelcert_decisions(application_id, created_at desc);
create index if not exists jewelcert_decisions_store_created_idx on jewelcert_decisions(store_id, created_at desc);

create table if not exists jewelcert_invites (
  id text primary key,
  application_id text not null references applications(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  assessment_package_id text,
  sent_by_user_id text references users(id) on delete set null,
  sent_to_email text not null,
  status text not null default 'sent' check (status in ('draft', 'sent', 'opened', 'started', 'completed', 'expired', 'cancelled')),
  component_ids jsonb not null default '[]'::jsonb,
  course_slugs jsonb not null default '[]'::jsonb,
  expires_at timestamptz,
  sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists jewelcert_invites_store_status_sent_idx on jewelcert_invites(store_id, status, sent_at desc);
create index if not exists jewelcert_invites_application_idx on jewelcert_invites(application_id);

create table if not exists gemmatch_invites (
  id text primary key,
  application_id text references applications(id) on delete cascade,
  team_member_id text,
  store_id text not null references stores(id) on delete cascade,
  sent_by_user_id text references users(id) on delete set null,
  status text not null default 'sent' check (status in ('draft', 'sent', 'started', 'completed', 'expired', 'cancelled')),
  result_profile_code text check (result_profile_code in ('V', 'C', 'F', 'D')),
  fit_rating text,
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists gemmatch_invites_store_status_created_idx on gemmatch_invites(store_id, status, created_at desc);
create index if not exists gemmatch_invites_application_idx on gemmatch_invites(application_id);

create table if not exists interviews (
  id text primary key,
  application_id text not null references applications(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  scheduled_by_user_id text references users(id) on delete set null,
  interviewer_user_ids jsonb not null default '[]'::jsonb,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location_type text not null check (location_type in ('in_store', 'phone', 'video')),
  location_details text,
  meet_link text,
  guest_emails jsonb not null default '[]'::jsonb,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interviews_store_status_starts_idx on interviews(store_id, status, starts_at);
create index if not exists interviews_application_idx on interviews(application_id);

create table if not exists hire_to_jewellink_syncs (
  id text primary key,
  application_id text not null references applications(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  jewellink_team_member_id text,
  synced_by_user_id text references users(id) on delete set null,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'failed', 'cancelled')),
  payload_snapshot jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  synced_at timestamptz,
  unique (application_id)
);

create index if not exists hire_to_jewellink_syncs_store_status_idx on hire_to_jewellink_syncs(store_id, sync_status);

create table if not exists locations (
  id text primary key,
  store_id text not null references stores(id) on delete cascade,
  name text not null,
  floor_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists locations_store_id_idx on locations(store_id);

create table if not exists team_members (
  id text primary key,
  store_id text not null references stores(id) on delete cascade,
  location_id text references locations(id) on delete set null,
  jewellink_team_member_id text unique,
  source_application_id text references applications(id) on delete set null,
  name text not null,
  initials text,
  role text,
  gemmatch_type text,
  primary_profile_code text check (primary_profile_code in ('V', 'C', 'F', 'D')),
  status text not null default 'active',
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_members_store_location_idx on team_members(store_id, location_id);

create table if not exists courses (
  id text primary key,
  slug text not null unique,
  title text not null,
  category text,
  duration_minutes integer,
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists course_tests (
  id text primary key,
  course_id text not null references courses(id) on delete cascade,
  title text not null,
  passing_correct_count integer not null default 1,
  question_count integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id)
);

create index if not exists course_tests_course_status_idx on course_tests(course_id, status);

create table if not exists course_test_questions (
  id text primary key,
  course_test_id text not null references course_tests(id) on delete cascade,
  prompt text not null,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists course_test_questions_test_sort_idx on course_test_questions(course_test_id, sort_order);

create table if not exists course_test_answers (
  id text primary key,
  question_id text not null references course_test_questions(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  is_correct boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists course_test_answers_question_sort_idx on course_test_answers(question_id, sort_order);

create table if not exists course_assignments (
  id text primary key,
  store_id text not null references stores(id) on delete cascade,
  course_id text not null references courses(id) on delete cascade,
  recipient_type text not null check (recipient_type in ('applicant', 'team_member')),
  recipient_id text not null,
  application_id text references applications(id) on delete cascade,
  team_member_id text references team_members(id) on delete cascade,
  assigned_by_user_id text references users(id) on delete set null,
  package_name text,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'expired', 'waived')),
  progress_percent integer not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  source text not null default 'manager' check (source in ('seed', 'manager', 'jewelcert', 'hire_handoff')),
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  completed_at timestamptz,
  last_activity_at timestamptz not null default now()
);

create index if not exists course_assignments_store_recipient_idx on course_assignments(store_id, recipient_type, recipient_id);
create index if not exists course_assignments_application_idx on course_assignments(application_id);
create index if not exists course_assignments_team_member_idx on course_assignments(team_member_id);

create table if not exists course_test_attempts (
  id text primary key,
  course_test_id text not null references course_tests(id) on delete cascade,
  course_id text not null references courses(id) on delete cascade,
  course_slug text not null,
  assignment_id text references course_assignments(id) on delete set null,
  recipient_id text,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  score_correct_count integer not null default 0,
  score_percent integer not null default 0,
  passed boolean not null default false,
  answers jsonb not null default '[]'::jsonb
);

create index if not exists course_test_attempts_assignment_completed_idx on course_test_attempts(assignment_id, completed_at desc);
create index if not exists course_test_attempts_course_completed_idx on course_test_attempts(course_slug, completed_at desc);

create table if not exists course_credentials (
  id text primary key,
  course_assignment_id text not null references course_assignments(id) on delete cascade,
  applicant_resume_id text references applicant_resumes(id) on delete cascade,
  course_id text not null references courses(id) on delete cascade,
  issuer text not null default 'JewelHire',
  issued_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (course_assignment_id)
);

create table if not exists billing_plans (
  id text primary key,
  tier text not null unique check (tier in ('starter', 'growth', 'pro')),
  price_cents integer not null default 0,
  billing_interval text not null default 'month' check (billing_interval in ('month', 'year')),
  seats_label text not null default '',
  features jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  plan_id text not null references billing_plans(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'cancelled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  provider text not null default 'manual',
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id)
);

create index if not exists subscriptions_company_status_idx on subscriptions(company_id, status);

create table if not exists invoices (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  subscription_id text references subscriptions(id) on delete set null,
  amount_cents integer not null default 0,
  status text not null default 'due' check (status in ('paid', 'due', 'past_due', 'void')),
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  provider_invoice_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_company_issued_idx on invoices(company_id, issued_at desc);
create index if not exists invoices_status_issued_idx on invoices(status, issued_at desc);

create table if not exists admin_audit_entries (
  id text primary key,
  actor_user_id text references users(id) on delete set null,
  actor_label text not null default 'platform',
  action text not null,
  target_type text not null,
  target_id text not null,
  target_label text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_entries_created_idx on admin_audit_entries(created_at desc);
create index if not exists admin_audit_entries_target_idx on admin_audit_entries(target_type, target_id);

create table if not exists impersonation_sessions (
  id text primary key,
  admin_user_id text references users(id) on delete set null,
  company_id text references companies(id) on delete cascade,
  store_id text references stores(id) on delete cascade,
  reason text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  audit_entry_id text references admin_audit_entries(id) on delete set null
);

create index if not exists impersonation_sessions_company_started_idx on impersonation_sessions(company_id, started_at desc);

create table if not exists domain_events (
  id text primary key,
  store_id text references stores(id) on delete cascade,
  company_id text references companies(id) on delete cascade,
  actor_user_id text references users(id) on delete set null,
  event_type text not null,
  subject_type text not null,
  subject_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists domain_events_store_created_idx on domain_events(store_id, created_at desc);
create index if not exists domain_events_subject_idx on domain_events(subject_type, subject_id);
