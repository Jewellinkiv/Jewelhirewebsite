-- JewelHire v2 Phase 1 demo seed.
-- Status: development/staging seed only. Do not apply to production.

insert into companies (id, name, owner_name, plan_tier, status, created_at, updated_at)
values
  ('co-sissys', 'Sissy''s Log Cabin', 'Sissy Jones', 'growth', 'active', '2026-06-01T14:00:00.000Z', '2026-06-20T15:35:00.000Z'),
  ('co-harbor', 'Harbor Gold', 'Leo Park', 'growth', 'active', '2026-06-03T14:00:00.000Z', '2026-06-20T15:35:00.000Z')
on conflict (id) do update set
  name = excluded.name,
  owner_name = excluded.owner_name,
  plan_tier = excluded.plan_tier,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into stores (id, company_id, name, slug, location_label, timezone, status, created_at, updated_at)
values
  ('store-sissys-little-rock', 'co-sissys', 'Sissy''s Log Cabin - Little Rock', 'sissys-log-cabin-careers', 'Little Rock, AR', 'America/Chicago', 'active', '2026-06-01T14:00:00.000Z', '2026-06-20T15:35:00.000Z'),
  ('store-harbor-memphis', 'co-harbor', 'Harbor Gold - Memphis', 'harbor-gold-careers', 'Memphis, TN', 'America/Chicago', 'active', '2026-06-03T14:00:00.000Z', '2026-06-20T15:35:00.000Z')
on conflict (id) do update set
  company_id = excluded.company_id,
  name = excluded.name,
  slug = excluded.slug,
  location_label = excluded.location_label,
  timezone = excluded.timezone,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into users (id, company_id, email, email_normalized, name, status, created_at, updated_at)
values
  ('user-hiring-manager', 'co-sissys', 'jordan@email.com', 'jordan@email.com', 'Jordan Smith', 'active', '2026-06-01T14:00:00.000Z', '2026-06-20T15:35:00.000Z'),
  ('user-sales-manager', 'co-sissys', 'maria@email.com', 'maria@email.com', 'Maria King', 'active', '2026-06-01T14:00:00.000Z', '2026-06-20T15:35:00.000Z'),
  ('user-harbor-owner', 'co-harbor', 'leo@harborgold.com', 'leo@harborgold.com', 'Leo Park', 'active', '2026-06-03T14:00:00.000Z', '2026-06-20T15:35:00.000Z')
on conflict (id) do update set
  company_id = excluded.company_id,
  email = excluded.email,
  email_normalized = excluded.email_normalized,
  name = excluded.name,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into store_users (id, store_id, user_id, role, status, created_at, updated_at)
values
  ('store-user-jordan', 'store-sissys-little-rock', 'user-hiring-manager', 'store_owner', 'active', '2026-06-01T14:00:00.000Z', '2026-06-20T15:35:00.000Z'),
  ('store-user-maria', 'store-sissys-little-rock', 'user-sales-manager', 'manager', 'active', '2026-06-01T14:00:00.000Z', '2026-06-20T15:35:00.000Z'),
  ('store-user-harbor-leo', 'store-harbor-memphis', 'user-harbor-owner', 'store_owner', 'active', '2026-06-03T14:00:00.000Z', '2026-06-20T15:35:00.000Z')
on conflict (store_id, user_id) do update set
  role = excluded.role,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into store_settings (
  store_id, organization_company, organization_primary_store, default_manager, workflow, notifications,
  created_at, updated_at
)
values (
  'store-sissys-little-rock',
  'Sissy''s Log Cabin',
  'Little Rock, Arkansas',
  'William Jones',
  '["Applied","Cert sent","GemMatch done","In review","Interview","Offer","Hired"]'::jsonb,
  '[
    {"label":"Candidate completes GemMatch","channel":"Email + in-app","owner":"Hiring manager"},
    {"label":"Assessment package expires","channel":"In-app","owner":"Store admin"},
    {"label":"Training assignment overdue","channel":"Email","owner":"Manager"},
    {"label":"New strong-fit candidate","channel":"Email + in-app","owner":"Manager"}
  ]'::jsonb,
  '2026-06-01T14:00:00.000Z',
  '2026-06-20T15:35:00.000Z'
)
on conflict (store_id) do update set
  organization_company = excluded.organization_company,
  organization_primary_store = excluded.organization_primary_store,
  default_manager = excluded.default_manager,
  workflow = excluded.workflow,
  notifications = excluded.notifications,
  updated_at = excluded.updated_at;

insert into store_invite_settings (
  store_id, calendar_provider, account, from_name, reply_to, timezone, default_duration,
  location, add_links, attach_ics, remind24, remind1, note_template, created_at, updated_at
)
values (
  'store-sissys-little-rock',
  'google',
  'hiring@sissyslogcabin.com',
  'Sissy''s Log Cabin Hiring',
  'hiring@sissyslogcabin.com',
  'America/Chicago (CT)',
  '45 min',
  'Sissy''s Log Cabin · 1023 Main St, Little Rock',
  true,
  true,
  true,
  false,
  'Hi {{candidate}}, we''d love to meet you for the {{role}} role at {{location}} on {{time}}. Reply here with any questions — looking forward to it!',
  '2026-06-01T14:00:00.000Z',
  '2026-06-20T15:35:00.000Z'
)
on conflict (store_id) do update set
  calendar_provider = excluded.calendar_provider,
  account = excluded.account,
  from_name = excluded.from_name,
  reply_to = excluded.reply_to,
  timezone = excluded.timezone,
  default_duration = excluded.default_duration,
  location = excluded.location,
  add_links = excluded.add_links,
  attach_ics = excluded.attach_ics,
  remind24 = excluded.remind24,
  remind1 = excluded.remind1,
  note_template = excluded.note_template,
  updated_at = excluded.updated_at;

insert into store_integrations (
  id, store_id, provider, account, status, scopes, connected_at, created_at, updated_at
)
values
  ('store-integration-google', 'store-sissys-little-rock', 'google', 'hiring@sissyslogcabin.com', 'connected', '["calendar.events","calendar.readonly","gmail.send"]'::jsonb, '2026-06-01T14:00:00.000Z', '2026-06-01T14:00:00.000Z', '2026-06-20T15:35:00.000Z'),
  ('store-integration-microsoft', 'store-sissys-little-rock', 'microsoft', '', 'disconnected', '["Calendars.ReadWrite","Mail.Send","offline_access"]'::jsonb, null, '2026-06-01T14:00:00.000Z', '2026-06-20T15:35:00.000Z')
on conflict (store_id, provider) do update set
  account = excluded.account,
  status = excluded.status,
  scopes = excluded.scopes,
  connected_at = excluded.connected_at,
  updated_at = excluded.updated_at;

insert into store_public_pages (
  id, store_id, slug, template_id, logo_text, logo_asset_id, theme, job_layout, headline, about, benefits,
  review_summary, show_reviews, status, created_at, updated_at, published_at
)
values
  (
    'public-page-sissys-careers',
    'store-sissys-little-rock',
    'sissys-log-cabin-careers',
    'classic',
    'Sissy''s Log Cabin',
    null,
    '{"primary":"#123FB9","accent":"#1f9e75","background":"#ffffff","text":"#1f2937"}'::jsonb,
    'cards',
    'Build a career in fine jewelry',
    'A family-owned fine jeweler hiring relationship-driven people for sales, service, and craftsmanship roles.',
    '["Health insurance","401(k)","Commission","Paid holidays","Employee discounts","On-site training"]'::jsonb,
    '{"rating":4.8,"count":42}'::jsonb,
    true,
    'published',
    '2026-06-01T14:00:00.000Z',
    '2026-06-20T15:35:00.000Z',
    '2026-06-01T14:00:00.000Z'
  ),
  (
    'public-page-harbor-careers',
    'store-harbor-memphis',
    'harbor-gold-careers',
    'classic',
    'Harbor Gold',
    null,
    '{"primary":"#123FB9","accent":"#1f9e75","background":"#ffffff","text":"#1f2937"}'::jsonb,
    'cards',
    'Join a growing luxury jewelry team',
    'A Memphis fine jeweler hiring clienteling-minded associates and future sales leaders.',
    '["Commission","Clienteling tools","Paid training","Flexible schedule"]'::jsonb,
    '{"rating":4.7,"count":18}'::jsonb,
    true,
    'published',
    '2026-06-03T14:00:00.000Z',
    '2026-06-20T15:35:00.000Z',
    '2026-06-03T14:00:00.000Z'
  )
on conflict (id) do update set
  headline = excluded.headline,
  about = excluded.about,
  benefits = excluded.benefits,
  logo_text = excluded.logo_text,
  logo_asset_id = excluded.logo_asset_id,
  theme = excluded.theme,
  job_layout = excluded.job_layout,
  review_summary = excluded.review_summary,
  show_reviews = excluded.show_reviews,
  status = excluded.status,
  updated_at = excluded.updated_at,
  published_at = excluded.published_at;

insert into public_page_testimonials (
  id, store_id, public_page_id, name, rating, text, source, status, created_at, updated_at
)
values
  ('testimonial-nisha-c', 'store-sissys-little-rock', 'public-page-sissys-careers', 'Nisha C.', 5, 'Beautiful store and the team treats you like family. Found the perfect ring here.', 'customer', 'published', '2026-06-01T14:00:00.000Z', '2026-06-01T14:00:00.000Z'),
  ('testimonial-marcus-t', 'store-sissys-little-rock', 'public-page-sissys-careers', 'Marcus T.', 5, 'Knowledgeable staff and an honest repair department. Highly recommend.', 'customer', 'published', '2026-06-01T14:00:00.000Z', '2026-06-01T14:00:00.000Z'),
  ('testimonial-dana-r', 'store-sissys-little-rock', 'public-page-sissys-careers', 'Dana R.', 4, 'Great selection for bridal. Friendly, no-pressure experience.', 'customer', 'published', '2026-06-01T14:00:00.000Z', '2026-06-01T14:00:00.000Z')
on conflict (id) do update set
  name = excluded.name,
  rating = excluded.rating,
  text = excluded.text,
  source = excluded.source,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into public_page_reviews (
  id, store_id, name, rating, text, when_label, source, status, created_at, updated_at
)
values
  ('review-nisha-c-1', 'store-sissys-little-rock', 'Nisha C.', 5, 'Beautiful store and the team treats you like family. Found the perfect ring here.', '2 months ago', 'store_seed', 'published', '2026-06-01T14:00:00.000Z', '2026-06-01T14:00:00.000Z'),
  ('review-marcus-t-2', 'store-sissys-little-rock', 'Marcus T.', 5, 'Knowledgeable staff and an honest repair department. Highly recommend.', '5 months ago', 'store_seed', 'published', '2026-06-01T14:00:00.000Z', '2026-06-01T14:00:00.000Z'),
  ('review-dana-r-3', 'store-sissys-little-rock', 'Dana R.', 4, 'Great selection for bridal. Friendly, no-pressure experience.', '8 months ago', 'store_seed', 'published', '2026-06-01T14:00:00.000Z', '2026-06-01T14:00:00.000Z')
on conflict (id) do update set
  name = excluded.name,
  rating = excluded.rating,
  text = excluded.text,
  when_label = excluded.when_label,
  source = excluded.source,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into public_jobs (
  id, store_id, public_page_id, slug, title, location, employment_type, compensation_summary,
  description, requirements, ideal_gemmatch_mix, required_assessment_ids, required_course_ids,
  status, opened_at, created_at, updated_at
)
values
  ('job-luxury-sales-associate', 'store-sissys-little-rock', 'public-page-sissys-careers', 'luxury-sales-associate', 'Luxury Jewelry Sales Associate', 'Little Rock, AR', 'Full-time', '$60,000 - $85,000', 'Deliver a luxury shopping experience, build a personal client book, and grow with structured jewelry training.', '["Client-facing sales experience","Strong follow-up habits","Weekend availability"]'::jsonb, '["C","F"]'::jsonb, '["sales-personality","jewelry-basic-knowledge"]'::jsonb, '["jewellink-premium-how-to"]'::jsonb, 'open', '2026-06-01T14:00:00.000Z', '2026-06-01T14:00:00.000Z', '2026-06-01T14:00:00.000Z'),
  ('job-sales-manager', 'store-sissys-little-rock', 'public-page-sissys-careers', 'sales-manager', 'Sales Manager', 'Little Rock, AR', 'Full-time', '$75,000 - $125,000', 'Coach a high-performing sales floor, drive clienteling, and help new associates ramp quickly.', '["Jewelry or luxury retail leadership","Coaching experience","Comfort with sales goals"]'::jsonb, '["D","C"]'::jsonb, '["sales-personality"]'::jsonb, '[]'::jsonb, 'open', '2026-06-05T14:00:00.000Z', '2026-06-05T14:00:00.000Z', '2026-06-05T14:00:00.000Z'),
  ('job-bench-jeweler', 'store-sissys-little-rock', 'public-page-sissys-careers', 'bench-jeweler', 'Bench Jeweler / Repair Specialist', 'Little Rock, AR', 'Full-time', '$55,000 - $90,000', 'Perform precision repair, sizing, and custom bench work for a quality-focused service department.', '["Bench jewelry experience","Stone setting familiarity","Quality control discipline"]'::jsonb, '["F","D"]'::jsonb, '["jewelry-basic-knowledge"]'::jsonb, '[]'::jsonb, 'open', '2026-06-08T14:00:00.000Z', '2026-06-08T14:00:00.000Z', '2026-06-08T14:00:00.000Z'),
  ('job-harbor-sales-manager', 'store-harbor-memphis', 'public-page-harbor-careers', 'sales-manager', 'Sales Manager', 'Memphis, TN', 'Full-time', '$70,000 - $115,000', 'Lead clienteling, coach associates, and help Harbor Gold grow its Memphis showroom.', '["Luxury retail leadership","Clienteling discipline","Comfort with sales goals"]'::jsonb, '["D","C"]'::jsonb, '["sales-personality"]'::jsonb, '["jewellink-premium-how-to"]'::jsonb, 'open', '2026-06-09T14:00:00.000Z', '2026-06-09T14:00:00.000Z', '2026-06-09T14:00:00.000Z')
on conflict (id) do update set
  title = excluded.title,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into applicant_profiles (
  id, full_name, email, email_normalized, phone, location, resume_headline, summary, visibility, created_at, updated_at
)
values
  ('profile-kate-pryor', 'Kate Pryor', 'kate.pryor@email.com', 'kate.pryor@email.com', '(501) 555-0111', 'Conway, AR', 'Client-focused retail associate', 'Three years in boutique retail with strong follow-up and warm client service.', 'private_store_application', '2026-06-22T13:15:00.000Z', '2026-06-22T13:28:00.000Z'),
  ('profile-bryan-lett', 'Bryan Lett', 'bryan.lett@email.com', 'bryan.lett@email.com', '(501) 555-0166', 'Little Rock, AR', 'Retail associate entering fine jewelry', 'Hard worker with customer-facing retail experience and interest in jewelry sales.', 'private_store_application', '2026-06-21T16:20:00.000Z', '2026-06-21T16:32:00.000Z'),
  ('profile-maya-chen', 'Maya Chen', 'maya.chen@email.com', 'maya.chen@email.com', '(501) 555-0148', 'Little Rock, AR', 'Luxury retail clienteling specialist', 'Six years in luxury retail, clienteling, and relationship-driven sales.', 'private_store_application', '2026-06-17T15:10:00.000Z', '2026-06-20T18:45:00.000Z'),
  ('profile-maya-harbor', 'Maya Chen', 'maya.chen@email.com', 'maya.chen@email.com', '(901) 555-0188', 'Memphis, TN', 'Luxury retail manager candidate', 'Same email as a Sissy''s applicant, intentionally seeded to verify Phase 1 store privacy.', 'private_store_application', '2026-06-18T12:10:00.000Z', '2026-06-20T12:45:00.000Z'),
  ('profile-devon-ross', 'Devon Ross', 'devon.ross@email.com', 'devon.ross@email.com', '(501) 555-0192', 'Little Rock, AR', 'Bench jeweler and CAD designer', 'Nine years of bench jewelry, repair, CAD, and precision quality control.', 'private_store_application', '2026-06-19T12:05:00.000Z', '2026-06-22T09:10:00.000Z'),
  ('profile-ana-raper', 'Ana Raper', 'ana.raper@email.com', 'ana.raper@email.com', '(501) 555-0177', 'Little Rock, AR', 'Relationship sales closer', 'Customer-facing sales background across automotive and retail with strong closing skills.', 'private_store_application', '2026-06-15T10:20:00.000Z', '2026-06-19T11:40:00.000Z'),
  ('profile-jess-wood', 'Jess Wood', 'jess.wood@email.com', 'jess.wood@email.com', '(501) 555-0123', 'Little Rock, AR', 'Sales manager and team coach', 'Sales manager with a track record of building high-performing retail teams.', 'private_store_application', '2026-06-12T09:00:00.000Z', '2026-06-22T14:15:00.000Z')
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  email_normalized = excluded.email_normalized,
  phone = excluded.phone,
  location = excluded.location,
  resume_headline = excluded.resume_headline,
  summary = excluded.summary,
  updated_at = excluded.updated_at;

insert into applicant_resumes (
  id, applicant_profile_id, summary, work_experience, education, skills, portfolio_links, course_credential_ids, created_at, updated_at
)
values
  ('resume-kate-pryor', 'profile-kate-pryor', 'Warm retail associate ready to move into fine jewelry.', '["Sales Associate, Finch Boutique","Client Service, Conway Gifts"]'::jsonb, '["University of Central Arkansas"]'::jsonb, '["Customer service","Follow-up","POS","Inventory care"]'::jsonb, '[]'::jsonb, '[]'::jsonb, '2026-06-22T13:28:00.000Z', '2026-06-22T13:28:00.000Z'),
  ('resume-maya-chen', 'profile-maya-chen', 'Luxury retail associate with a repeat-client book and bridal sales experience.', '["Senior Stylist, Hart & Lane","Client Advisor, Bellamy Bridal"]'::jsonb, '["BA Marketing, UALR"]'::jsonb, '["Clienteling","Bridal consultation","CRM follow-up","Luxury service"]'::jsonb, '["https://example.com/maya-client-book"]'::jsonb, '["course-credential-four-cs-maya"]'::jsonb, '2026-06-20T18:45:00.000Z', '2026-06-20T18:45:00.000Z'),
  ('resume-maya-harbor', 'profile-maya-harbor', 'Manager candidate for Harbor Gold with the same email as another store applicant.', '["Assistant Manager, River City Jewelers","Client Advisor, Memphis Bridal Co."]'::jsonb, '["Retail leadership coursework"]'::jsonb, '["Clienteling","Coaching","Luxury service","CRM follow-up"]'::jsonb, '[]'::jsonb, '[]'::jsonb, '2026-06-20T12:45:00.000Z', '2026-06-20T12:45:00.000Z'),
  ('resume-devon-ross', 'profile-devon-ross', 'Bench jeweler focused on precision repair, custom work, and documentation.', '["Bench Jeweler, Oak Street Jewelers","CAD Assistant, Studio North"]'::jsonb, '["GIA Bench Jewelry coursework"]'::jsonb, '["Sizing","Stone setting","CAD","Quality control"]'::jsonb, '["https://example.com/devon-repairs"]'::jsonb, '[]'::jsonb, '2026-06-22T09:10:00.000Z', '2026-06-22T09:10:00.000Z'),
  ('resume-jess-wood', 'profile-jess-wood', 'Sales leader who coaches with clear targets and clienteling habits.', '["Assistant Manager, Lumen Fine Jewelry","Sales Lead, Heritage Bridal"]'::jsonb, '["Retail leadership certificate"]'::jsonb, '["Sales coaching","Clienteling","Pipeline management","Team onboarding"]'::jsonb, '[]'::jsonb, '["course-credential-jewellink-premium-how-to-jess"]'::jsonb, '2026-06-22T14:15:00.000Z', '2026-06-22T14:15:00.000Z')
on conflict (id) do update set
  summary = excluded.summary,
  work_experience = excluded.work_experience,
  education = excluded.education,
  skills = excluded.skills,
  portfolio_links = excluded.portfolio_links,
  course_credential_ids = excluded.course_credential_ids,
  updated_at = excluded.updated_at;

insert into applications (
  id, store_id, job_id, applicant_profile_id, source, stage, status_reason, current_owner_user_id,
  submitted_at, last_activity_at, created_at, updated_at
)
values
  ('app-kate-pryor', 'store-sissys-little-rock', 'job-luxury-sales-associate', 'profile-kate-pryor', 'public_store_page', 'applied', null, null, '2026-06-22T13:30:00.000Z', '2026-06-22T13:30:00.000Z', '2026-06-22T13:30:00.000Z', '2026-06-22T13:30:00.000Z'),
  ('app-bryan-lett', 'store-sissys-little-rock', 'job-luxury-sales-associate', 'profile-bryan-lett', 'public_store_page', 'jewelcert', null, 'user-hiring-manager', '2026-06-21T16:35:00.000Z', '2026-06-22T09:00:00.000Z', '2026-06-21T16:35:00.000Z', '2026-06-22T09:00:00.000Z'),
  ('app-maya-chen', 'store-sissys-little-rock', 'job-luxury-sales-associate', 'profile-maya-chen', 'public_store_page', 'interview', null, 'user-hiring-manager', '2026-06-17T15:20:00.000Z', '2026-06-23T14:30:00.000Z', '2026-06-17T15:20:00.000Z', '2026-06-23T14:30:00.000Z'),
  ('app-maya-harbor', 'store-harbor-memphis', 'job-harbor-sales-manager', 'profile-maya-harbor', 'public_store_page', 'applied', null, 'user-harbor-owner', '2026-06-18T12:20:00.000Z', '2026-06-20T12:45:00.000Z', '2026-06-18T12:20:00.000Z', '2026-06-20T12:45:00.000Z'),
  ('app-devon-ross', 'store-sissys-little-rock', 'job-bench-jeweler', 'profile-devon-ross', 'referral', 'gemmatch', null, 'user-hiring-manager', '2026-06-19T12:10:00.000Z', '2026-06-22T09:30:00.000Z', '2026-06-19T12:10:00.000Z', '2026-06-22T09:30:00.000Z'),
  ('app-ana-raper', 'store-sissys-little-rock', 'job-luxury-sales-associate', 'profile-ana-raper', 'public_store_page', 'rejected', 'Team fit concern for current floor mix', 'user-hiring-manager', '2026-06-15T10:25:00.000Z', '2026-06-20T11:00:00.000Z', '2026-06-15T10:25:00.000Z', '2026-06-20T11:00:00.000Z'),
  ('app-jess-wood', 'store-sissys-little-rock', 'job-sales-manager', 'profile-jess-wood', 'manual_store_entry', 'hired', null, 'user-hiring-manager', '2026-06-12T09:15:00.000Z', '2026-06-22T14:30:00.000Z', '2026-06-12T09:15:00.000Z', '2026-06-22T14:30:00.000Z')
on conflict (id) do update set
  stage = excluded.stage,
  status_reason = excluded.status_reason,
  current_owner_user_id = excluded.current_owner_user_id,
  last_activity_at = excluded.last_activity_at,
  updated_at = excluded.updated_at;

insert into application_stage_events (id, application_id, store_id, from_stage, to_stage, actor_user_id, reason, created_at)
values
  ('event-kate-applied', 'app-kate-pryor', 'store-sissys-little-rock', null, 'applied', null, 'Application submitted', '2026-06-22T13:30:00.000Z'),
  ('event-bryan-applied', 'app-bryan-lett', 'store-sissys-little-rock', null, 'applied', null, 'Application submitted', '2026-06-21T16:35:00.000Z'),
  ('event-bryan-jewelcert', 'app-bryan-lett', 'store-sissys-little-rock', 'applied', 'jewelcert', 'user-hiring-manager', 'Sent JewelCert package', '2026-06-22T09:00:00.000Z'),
  ('event-maya-applied', 'app-maya-chen', 'store-sissys-little-rock', null, 'applied', null, 'Application submitted', '2026-06-17T15:20:00.000Z'),
  ('event-maya-jewelcert', 'app-maya-chen', 'store-sissys-little-rock', 'applied', 'jewelcert', 'user-hiring-manager', 'Sent JewelCert package', '2026-06-18T09:00:00.000Z'),
  ('event-maya-gemmatch', 'app-maya-chen', 'store-sissys-little-rock', 'jewelcert', 'gemmatch', 'user-hiring-manager', 'Invited to GemMatch', '2026-06-19T10:15:00.000Z'),
  ('event-maya-interview', 'app-maya-chen', 'store-sissys-little-rock', 'gemmatch', 'interview', 'user-hiring-manager', 'Scheduled first interview', '2026-06-23T14:30:00.000Z'),
  ('event-maya-harbor-applied', 'app-maya-harbor', 'store-harbor-memphis', null, 'applied', null, 'Application submitted', '2026-06-18T12:20:00.000Z'),
  ('event-devon-gemmatch', 'app-devon-ross', 'store-sissys-little-rock', 'jewelcert', 'gemmatch', 'user-hiring-manager', 'Completed JewelCert with strong score', '2026-06-22T09:30:00.000Z'),
  ('event-ana-rejected', 'app-ana-raper', 'store-sissys-little-rock', 'gemmatch', 'rejected', 'user-hiring-manager', 'Team fit concern for current floor mix', '2026-06-20T11:00:00.000Z'),
  ('event-jess-hired', 'app-jess-wood', 'store-sissys-little-rock', 'offer', 'hired', 'user-hiring-manager', 'Offer accepted and synced to JewelLink', '2026-06-22T14:30:00.000Z')
on conflict (id) do nothing;

insert into applicant_notes (id, application_id, store_id, author_user_id, body, visibility, note_type, created_at, updated_at)
values
  ('note-kate-1', 'app-kate-pryor', 'store-sissys-little-rock', 'user-hiring-manager', 'Warm profile. Send JewelCert if she replies to availability follow-up.', 'store_internal', 'general', '2026-06-22T13:35:00.000Z', '2026-06-22T13:35:00.000Z'),
  ('note-maya-1', 'app-maya-chen', 'store-sissys-little-rock', 'user-hiring-manager', 'Strong clienteling background. Ask about bridal follow-up rhythm in interview.', 'store_internal', 'screening', '2026-06-20T17:00:00.000Z', '2026-06-20T17:00:00.000Z'),
  ('note-maya-harbor-1', 'app-maya-harbor', 'store-harbor-memphis', 'user-harbor-owner', 'Same email as another store applicant; should remain private to Harbor Gold.', 'store_internal', 'screening', '2026-06-20T12:45:00.000Z', '2026-06-20T12:45:00.000Z'),
  ('note-jess-1', 'app-jess-wood', 'store-sissys-little-rock', 'user-hiring-manager', 'Offer accepted. Sync manager profile and GemMatch summary into JewelLink.', 'store_internal', 'hire_handoff', '2026-06-22T14:35:00.000Z', '2026-06-22T14:35:00.000Z')
on conflict (id) do update set
  body = excluded.body,
  updated_at = excluded.updated_at,
  deleted_at = null;

insert into assessments (
  id, store_id, owner, title, description, kind, status, targets, media, question_count, duration_minutes, created_at, updated_at
)
values
  ('ca1', 'store-sissys-little-rock', 'store', 'Diamond 4Cs — store knowledge', 'Quick check on cut, color, clarity, and carat for new floor associates.', 'Knowledge check', 'Published', '["Diamonds","Sales floor knowledge"]'::jsonb, '[]'::jsonb, 3, 8, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ca2', 'store-sissys-little-rock', 'store', 'Clienteling style', 'How an associate prefers to build long-term client relationships.', 'Trait profile', 'Draft', '["Clienteling","Relationship building"]'::jsonb, '[]'::jsonb, 2, 5, '2026-06-21T14:00:00.000Z', '2026-06-21T14:00:00.000Z')
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  kind = excluded.kind,
  status = excluded.status,
  targets = excluded.targets,
  media = excluded.media,
  question_count = excluded.question_count,
  duration_minutes = excluded.duration_minutes,
  updated_at = excluded.updated_at;

insert into assessment_questions (
  id, assessment_id, question_type, prompt, options, answer_index, sort_order, created_at, updated_at
)
values
  ('ca1-q1', 'ca1', 'multiple-choice', 'Which C refers to a diamond''s sparkle and light return?', '["Carat","Cut","Clarity","Color"]'::jsonb, 1, 1, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ca1-q2', 'ca1', 'multiple-choice', 'Color is graded on a scale from…', '["1–10","A–F","D–Z","I–V"]'::jsonb, 2, 2, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ca1-q3', 'ca1', 'short-answer', 'In your own words, how would you explain clarity to a first-time buyer?', '[]'::jsonb, null, 3, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ca2-q1', 'ca2', 'scale', 'I follow up with past clients on their important dates.', '[]'::jsonb, null, 1, '2026-06-21T14:00:00.000Z', '2026-06-21T14:00:00.000Z'),
  ('ca2-q2', 'ca2', 'scale', 'I enjoy guiding an undecided customer to the right piece.', '[]'::jsonb, null, 2, '2026-06-21T14:00:00.000Z', '2026-06-21T14:00:00.000Z')
on conflict (id) do update set
  question_type = excluded.question_type,
  prompt = excluded.prompt,
  options = excluded.options,
  answer_index = excluded.answer_index,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;

insert into assessment_results (
  id, store_id, application_id, assessment_id, slug, title, result_type, candidate, completed_at, duration_minutes,
  status, total_score, score_label, summary, categories, traits, answer_review, recommendation, follow_ups, created_at, updated_at
)
values
  (
    'assessment-result-jewelry-basic-knowledge',
    'store-sissys-little-rock',
    'app-maya-chen',
    null,
    'jewelry-basic-knowledge',
    'Jewelry Basic Knowledge Assessment',
    'knowledge_check',
    '{"id":"maya-chen","name":"Maya Chen","initials":"MC","role":"Sales Associate"}'::jsonb,
    'Jun 19, 2026',
    41,
    'Needs review',
    68,
    'Foundational',
    'Strong on metals and repairs, with clear gaps in diamonds and gemstones. Solid base for a sales role, but recommend knowledge coaching before leading diamond conversations.',
    '[{"target":"Metals","score":4,"max":4,"pct":100},{"target":"Gemstones","score":2,"max":3,"pct":67},{"target":"Diamonds","score":2,"max":4,"pct":50},{"target":"Jewelry Types","score":3,"max":4,"pct":75},{"target":"Settings & Mountings","score":1,"max":3,"pct":40},{"target":"Watches","score":1,"max":2,"pct":50},{"target":"Jewelry Repairs","score":2,"max":2,"pct":80}]'::jsonb,
    '[]'::jsonb,
    '[{"n":1,"prompt":"What is the primary reason for rhodium plating on white gold?","target":"Metals","selected":{"text":"Provide a bright, white, and reflective finish","points":4},"preferred":{"text":"Provide a bright, white, and reflective finish","points":4},"correct":true},{"n":2,"prompt":"Which marking are you most likely to see on sterling silver?","target":"Metals","selected":{"text":"925","points":4},"preferred":{"text":"925","points":4},"correct":true},{"n":4,"prompt":"Which gemstone is the hardest on the Mohs scale?","target":"Gemstones","selected":{"text":"Sapphire","points":1},"preferred":{"text":"Diamond","points":4},"correct":false},{"n":7,"prompt":"What does \"fire\" mean when it pertains to diamonds?","target":"Diamonds","selected":{"text":"The sparkle produced by its facets","points":1},"preferred":{"text":"The dispersion of light into spectral colors","points":4},"correct":false},{"n":8,"prompt":"What does \"clarity\" measure in a diamond?","target":"Diamonds","selected":{"text":"The diamond''s ability to refract light","points":1},"preferred":{"text":"The presence of inclusions and blemishes","points":4},"correct":false}]'::jsonb,
    '{"decision":"Advance with coaching","text":"Maya''s product knowledge is a good base, not a blocker for a relationship-led sales role. Before she leads high-ticket diamond sales, assign the diamonds/gemstones training below and re-check."}'::jsonb,
    '[{"course":"Mastering the Four C''s: A Guide to Diamond Excellence","reason":"Closes the Diamonds gap (50%)","href":"/learn"},{"course":"Gemstone Essentials","reason":"Reinforces Gemstones (67%)","href":"/learn"}]'::jsonb,
    '2026-06-19T09:40:00.000Z',
    '2026-06-19T09:40:00.000Z'
  ),
  (
    'assessment-result-sales-personality',
    'store-sissys-little-rock',
    'app-maya-chen',
    null,
    'sales-personality',
    'Sales Personality Profiling Test',
    'trait_profile',
    '{"id":"maya-chen","name":"Maya Chen","initials":"MC","role":"Sales Associate"}'::jsonb,
    'Jun 19, 2026',
    22,
    'Needs review',
    0,
    'Relationship Champion',
    'Leans strongly to Relationship Champion with solid Detail-Oriented Educator support — consistent with her GemMatch Luxury Advisor profile. Lower on Assertive Negotiator; pair with a closer on high-pressure deals.',
    '[]'::jsonb,
    '[{"trait":"Relationship Champion","pct":86,"level":"Strong"},{"trait":"Detail-Oriented Educator","pct":64,"level":"Solid"},{"trait":"Strategic Closer","pct":41,"level":"Developing"},{"trait":"Assertive Negotiator","pct":28,"level":"Low"}]'::jsonb,
    '[{"n":5,"prompt":"How do you prefer to build a sale?","target":"Relationship Champion","selected":{"text":"Get to know the client and what the moment means to them","points":4}},{"n":11,"prompt":"A client is unsure between two pieces. You…","target":"Detail-Oriented Educator","selected":{"text":"Walk them through the differences so they decide with confidence","points":3}},{"n":18,"prompt":"When a deal stalls on price, you…","target":"Assertive Negotiator","selected":{"text":"Give them space and follow up later","points":1}}]'::jsonb,
    '{"decision":"Strong cultural fit","text":"Her relationship-first style fits clienteling and bridal. To protect margin on high-ticket deals, partner her with a Strategic Closer / Determined teammate rather than coaching her into a hard-closer role."}'::jsonb,
    '[{"course":"Confident Closing Without the Pressure","reason":"Lifts Assertive Negotiator (28%)","href":"/learn"}]'::jsonb,
    '2026-06-19T09:40:00.000Z',
    '2026-06-19T09:40:00.000Z'
  )
on conflict (store_id, slug) do update set
  application_id = excluded.application_id,
  title = excluded.title,
  result_type = excluded.result_type,
  candidate = excluded.candidate,
  completed_at = excluded.completed_at,
  duration_minutes = excluded.duration_minutes,
  status = excluded.status,
  total_score = excluded.total_score,
  score_label = excluded.score_label,
  summary = excluded.summary,
  categories = excluded.categories,
  traits = excluded.traits,
  answer_review = excluded.answer_review,
  recommendation = excluded.recommendation,
  follow_ups = excluded.follow_ups,
  updated_at = excluded.updated_at;

insert into jewelcert_invites (
  id, application_id, store_id, assessment_package_id, sent_by_user_id, sent_to_email, status,
  component_ids, course_slugs, expires_at, sent_at, completed_at, created_at
)
values
  ('jewelcert-bryan', 'app-bryan-lett', 'store-sissys-little-rock', 'package-sales-associate-screen', 'user-hiring-manager', 'bryan.lett@email.com', 'sent', '["gemmatch","sales-personality","jewelry-basic-knowledge"]'::jsonb, '[]'::jsonb, '2026-06-29T09:00:00.000Z', '2026-06-22T09:00:00.000Z', null, '2026-06-22T09:00:00.000Z'),
  ('jewelcert-maya', 'app-maya-chen', 'store-sissys-little-rock', 'package-sales-associate-screen', 'user-hiring-manager', 'maya.chen@email.com', 'completed', '["gemmatch","sales-personality","jewelry-basic-knowledge"]'::jsonb, '["jewellink-premium-how-to"]'::jsonb, '2026-06-25T09:00:00.000Z', '2026-06-18T09:00:00.000Z', '2026-06-19T09:40:00.000Z', '2026-06-18T09:00:00.000Z'),
  ('jewelcert-devon', 'app-devon-ross', 'store-sissys-little-rock', 'package-bench-jeweler-screen', 'user-hiring-manager', 'devon.ross@email.com', 'completed', '["gemmatch","jewelry-basic-knowledge"]'::jsonb, '[]'::jsonb, '2026-06-26T09:00:00.000Z', '2026-06-20T09:00:00.000Z', '2026-06-22T09:15:00.000Z', '2026-06-20T09:00:00.000Z')
on conflict (id) do update set
  status = excluded.status,
  component_ids = excluded.component_ids,
  course_slugs = excluded.course_slugs,
  completed_at = excluded.completed_at;

insert into gemmatch_invites (
  id, application_id, store_id, sent_by_user_id, status, result_profile_code, fit_rating, result_payload, created_at, completed_at
)
values
  ('gemmatch-maya', 'app-maya-chen', 'store-sissys-little-rock', 'user-hiring-manager', 'completed', 'C', 'Good fit', '{"type":"Luxury Advisor"}'::jsonb, '2026-06-19T10:15:00.000Z', '2026-06-20T16:00:00.000Z'),
  ('gemmatch-devon', 'app-devon-ross', 'store-sissys-little-rock', 'user-hiring-manager', 'completed', 'F', 'Strong fit', '{"type":"Master Craftsman"}'::jsonb, '2026-06-22T09:20:00.000Z', '2026-06-22T09:30:00.000Z'),
  ('gemmatch-ana', 'app-ana-raper', 'store-sissys-little-rock', 'user-hiring-manager', 'completed', 'V', 'Poor fit', '{"type":"Trailblazer"}'::jsonb, '2026-06-18T10:00:00.000Z', '2026-06-19T10:30:00.000Z')
on conflict (id) do update set
  status = excluded.status,
  result_profile_code = excluded.result_profile_code,
  fit_rating = excluded.fit_rating,
  result_payload = excluded.result_payload,
  completed_at = excluded.completed_at;

insert into interviews (
  id, application_id, store_id, scheduled_by_user_id, interviewer_user_ids, starts_at, ends_at,
  location_type, location_details, status, outcome, created_at, updated_at
)
values
  ('interview-maya-first', 'app-maya-chen', 'store-sissys-little-rock', 'user-hiring-manager', '["user-hiring-manager","user-sales-manager"]'::jsonb, '2026-06-25T19:30:00.000Z', '2026-06-25T20:00:00.000Z', 'in_store', 'Little Rock showroom', 'scheduled', null, '2026-06-23T14:30:00.000Z', '2026-06-23T14:30:00.000Z'),
  ('interview-jess-final', 'app-jess-wood', 'store-sissys-little-rock', 'user-hiring-manager', '["user-hiring-manager"]'::jsonb, '2026-06-21T16:00:00.000Z', '2026-06-21T17:00:00.000Z', 'video', 'JewelLink video room', 'completed', 'Strong leadership fit; moved to offer.', '2026-06-20T14:00:00.000Z', '2026-06-21T17:05:00.000Z')
on conflict (id) do update set
  status = excluded.status,
  outcome = excluded.outcome,
  updated_at = excluded.updated_at;

insert into locations (id, store_id, name, floor_type, created_at, updated_at)
values ('location-little-rock', 'store-sissys-little-rock', 'Little Rock', 'Powerhouse', '2026-06-01T14:00:00.000Z', '2026-06-20T15:35:00.000Z')
on conflict (id) do update set name = excluded.name, floor_type = excluded.floor_type, updated_at = excluded.updated_at;

insert into team_members (
  id, store_id, location_id, jewellink_team_member_id, source_application_id, name, initials, role,
  gemmatch_type, primary_profile_code, status, next_action, created_at, updated_at
)
values
  ('team-jess-wood', 'store-sissys-little-rock', 'location-little-rock', 'jl-team-jess-wood', 'app-jess-wood', 'Jess Wood', 'JW', 'Sales Manager', 'Sales Strategist', 'D', 'active', 'Start date onboarding', '2026-06-22T14:30:00.000Z', '2026-06-22T14:30:00.000Z')
on conflict (id) do update set
  jewellink_team_member_id = excluded.jewellink_team_member_id,
  role = excluded.role,
  status = excluded.status,
  next_action = excluded.next_action,
  updated_at = excluded.updated_at;

insert into courses (id, slug, title, category, duration_minutes, description, status, created_at, updated_at)
values
  ('course-jewellink-premium-how-to', 'jewellink-premium-how-to', 'JewelLink Premium How To', 'Platform', 1200, 'A series of videos and tools that introduce jewelry businesses to JewelLink.', 'published', '2026-06-01T14:00:00.000Z', '2026-06-20T15:35:00.000Z'),
  ('course-four-cs', 'four-cs', 'Mastering the Four C''s: Diamond Excellence', 'Product', 60, 'Confidently navigate Carat, Clarity, Color, and Cut.', 'published', '2026-06-01T14:00:00.000Z', '2026-06-20T15:35:00.000Z')
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  category = excluded.category,
  duration_minutes = excluded.duration_minutes,
  description = excluded.description,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into course_tests (
  id, course_id, title, passing_correct_count, question_count, status, created_at, updated_at
)
values
  ('ct-jewellink-premium-how-to', 'course-jewellink-premium-how-to', 'JewelLink Premium How To final check', 2, 3, 'published', '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-four-cs', 'course-four-cs', 'Four C''s final check', 2, 3, 'published', '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z')
on conflict (id) do update set
  title = excluded.title,
  passing_correct_count = excluded.passing_correct_count,
  question_count = excluded.question_count,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into course_test_questions (
  id, course_test_id, prompt, sort_order, status, created_at, updated_at
)
values
  ('ct-jl-q-store-profile', 'ct-jewellink-premium-how-to', 'What should be completed before a store starts posting jobs?', 1, 'published', '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-jl-q-gemmatch', 'ct-jewellink-premium-how-to', 'Where should GemMatch be used in JewelHire v2?', 2, 'published', '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-jl-q-training', 'ct-jewellink-premium-how-to', 'What happens when an associate completes a course?', 3, 'published', '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-four-cs-q-cut', 'ct-four-cs', 'Which C most directly describes sparkle and light return?', 1, 'published', '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-four-cs-q-color', 'ct-four-cs', 'Which diamond color range is commonly used for grading?', 2, 'published', '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-four-cs-q-clarity', 'ct-four-cs', 'What does clarity primarily evaluate?', 3, 'published', '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z')
on conflict (id) do update set
  prompt = excluded.prompt,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into course_test_answers (
  id, question_id, label, sort_order, is_correct, created_at, updated_at
)
values
  ('ct-jl-a-profile', 'ct-jl-q-store-profile', 'Store profile and brand basics', 1, true, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-jl-a-random', 'ct-jl-q-store-profile', 'Only the owner biography', 2, false, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-jl-a-none', 'ct-jl-q-store-profile', 'Nothing; jobs publish without setup', 3, false, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-jl-a-marketplace', 'ct-jl-q-gemmatch', 'To rank candidates across every company', 1, false, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-jl-a-private', 'ct-jl-q-gemmatch', 'Inside a store''s private hiring and team-fit workflow', 2, true, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-jl-a-review', 'ct-jl-q-gemmatch', 'As public candidate reviews', 3, false, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-jl-a-resume', 'ct-jl-q-training', 'The completion can become a resume credential', 1, true, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-jl-a-delete', 'ct-jl-q-training', 'Their application is deleted', 2, false, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-jl-a-market', 'ct-jl-q-training', 'They enter a public candidate marketplace', 3, false, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-four-cs-a-carat', 'ct-four-cs-q-cut', 'Carat', 1, false, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-four-cs-a-cut', 'ct-four-cs-q-cut', 'Cut', 2, true, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-four-cs-a-color', 'ct-four-cs-q-cut', 'Color', 3, false, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-four-cs-a-dz', 'ct-four-cs-q-color', 'D-Z', 1, true, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-four-cs-a-az', 'ct-four-cs-q-color', 'A-Z', 2, false, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-four-cs-a-110', 'ct-four-cs-q-color', '1-10', 3, false, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-four-cs-a-size', 'ct-four-cs-q-clarity', 'Diamond size', 1, false, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-four-cs-a-metal', 'ct-four-cs-q-clarity', 'Setting metal', 2, false, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z'),
  ('ct-four-cs-a-inclusions', 'ct-four-cs-q-clarity', 'Inclusions and blemishes', 3, true, '2026-06-18T14:00:00.000Z', '2026-06-18T14:00:00.000Z')
on conflict (id) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  is_correct = excluded.is_correct,
  updated_at = excluded.updated_at;

insert into course_assignments (
  id, store_id, course_id, recipient_type, recipient_id, application_id, assigned_by_user_id,
  package_name, status, progress_percent, source, assigned_at, due_at, completed_at, last_activity_at
)
values
  ('tr1', 'store-sissys-little-rock', 'course-four-cs', 'applicant', 'profile-maya-chen', 'app-maya-chen', 'user-hiring-manager', 'JewelCert follow-up training', 'completed', 100, 'jewelcert', '2026-06-19T10:00:00.000Z', null, '2026-06-20T18:45:00.000Z', '2026-06-20T18:45:00.000Z'),
  ('tr2', 'store-sissys-little-rock', 'course-jewellink-premium-how-to', 'team_member', 'team-jess-wood', 'app-jess-wood', 'user-hiring-manager', 'Hire handoff onboarding', 'completed', 100, 'hire_handoff', '2026-06-22T14:30:00.000Z', null, '2026-06-22T14:55:00.000Z', '2026-06-22T14:55:00.000Z')
on conflict (id) do update set
  status = excluded.status,
  progress_percent = excluded.progress_percent,
  completed_at = excluded.completed_at,
  last_activity_at = excluded.last_activity_at;

insert into course_credentials (
  id, course_assignment_id, applicant_resume_id, course_id, issuer, issued_at, metadata
)
values
  ('course-credential-four-cs-maya', 'tr1', 'resume-maya-chen', 'course-four-cs', 'JewelHire', '2026-06-20T18:45:00.000Z', '{"display":"Four C''s completion"}'::jsonb),
  ('course-credential-jewellink-premium-how-to-jess', 'tr2', 'resume-jess-wood', 'course-jewellink-premium-how-to', 'JewelHire', '2026-06-22T14:55:00.000Z', '{"display":"JewelLink Premium How To completion"}'::jsonb)
on conflict (course_assignment_id) do update set
  applicant_resume_id = excluded.applicant_resume_id,
  course_id = excluded.course_id,
  issued_at = excluded.issued_at,
  metadata = excluded.metadata;

insert into billing_plans (
  id, tier, price_cents, billing_interval, seats_label, features, status, created_at, updated_at
)
values
  ('plan-starter', 'starter', 4900, 'month', 'Up to 2 seats', '["GemMatch","1 store","Email invites"]'::jsonb, 'active', '2026-06-01T14:00:00.000Z', '2026-06-20T15:35:00.000Z'),
  ('plan-growth', 'growth', 14900, 'month', 'Up to 5 seats', '["Everything in Starter","Up to 3 stores","Custom assessments","Calendar sync"]'::jsonb, 'active', '2026-06-01T14:00:00.000Z', '2026-06-20T15:35:00.000Z'),
  ('plan-pro', 'pro', 34900, 'month', 'Unlimited seats', '["Everything in Growth","Unlimited stores","Priority support","Analytics"]'::jsonb, 'active', '2026-06-01T14:00:00.000Z', '2026-06-20T15:35:00.000Z')
on conflict (id) do update set
  price_cents = excluded.price_cents,
  billing_interval = excluded.billing_interval,
  seats_label = excluded.seats_label,
  features = excluded.features,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into subscriptions (
  id, company_id, plan_id, status, current_period_start, current_period_end, provider,
  provider_subscription_id, created_at, updated_at
)
values
  (
    'sub-sissys-pro',
    'co-sissys',
    'plan-pro',
    'active',
    '2026-06-01T14:00:00.000Z',
    '2026-07-01T14:00:00.000Z',
    'manual',
    'manual-sub-sissys-pro',
    '2026-06-01T14:00:00.000Z',
    '2026-06-20T15:35:00.000Z'
  ),
  (
    'sub-harbor-growth',
    'co-harbor',
    'plan-growth',
    'active',
    '2026-06-03T14:00:00.000Z',
    '2026-07-03T14:00:00.000Z',
    'manual',
    'manual-sub-harbor-growth',
    '2026-06-03T14:00:00.000Z',
    '2026-06-20T15:35:00.000Z'
  )
on conflict (company_id) do update set
  plan_id = excluded.plan_id,
  status = excluded.status,
  current_period_start = excluded.current_period_start,
  current_period_end = excluded.current_period_end,
  provider = excluded.provider,
  provider_subscription_id = excluded.provider_subscription_id,
  updated_at = excluded.updated_at;

insert into invoices (
  id, company_id, subscription_id, amount_cents, status, issued_at, paid_at, provider_invoice_id,
  created_at, updated_at
)
values
  (
    'inv-sissys-2026-06',
    'co-sissys',
    'sub-sissys-pro',
    34900,
    'paid',
    '2026-06-01T14:00:00.000Z',
    '2026-06-01T14:05:00.000Z',
    'manual-inv-sissys-2026-06',
    '2026-06-01T14:00:00.000Z',
    '2026-06-01T14:05:00.000Z'
  ),
  (
    'inv-harbor-2026-06',
    'co-harbor',
    'sub-harbor-growth',
    14900,
    'paid',
    '2026-06-03T14:00:00.000Z',
    '2026-06-03T14:05:00.000Z',
    'manual-inv-harbor-2026-06',
    '2026-06-03T14:00:00.000Z',
    '2026-06-03T14:05:00.000Z'
  )
on conflict (id) do update set
  amount_cents = excluded.amount_cents,
  status = excluded.status,
  issued_at = excluded.issued_at,
  paid_at = excluded.paid_at,
  provider_invoice_id = excluded.provider_invoice_id,
  updated_at = excluded.updated_at;

insert into admin_audit_entries (
  id, actor_user_id, actor_label, action, target_type, target_id, target_label, metadata, created_at
)
values
  ('admin-audit-view-sissys', null, 'you', 'Viewed as', 'company', 'co-sissys', 'Sissy''s Log Cabin', '{"source":"seed"}'::jsonb, '2026-06-20T15:35:00.000Z'),
  ('admin-audit-view-harbor', null, 'you', 'Viewed as', 'company', 'co-harbor', 'Harbor Gold', '{"source":"seed"}'::jsonb, '2026-06-20T15:35:30.000Z'),
  ('admin-audit-seed-loaded', null, 'seed runner', 'Seed loaded', 'store', 'store-sissys-little-rock', 'Sissy''s Log Cabin - Little Rock', '{"seed":"0001_demo_phase1"}'::jsonb, '2026-06-20T15:36:00.000Z')
on conflict (id) do update set
  actor_label = excluded.actor_label,
  action = excluded.action,
  target_label = excluded.target_label,
  metadata = excluded.metadata,
  created_at = excluded.created_at;

insert into hire_to_jewellink_syncs (
  id, application_id, store_id, jewellink_team_member_id, synced_by_user_id, sync_status,
  payload_snapshot, created_at, synced_at
)
values (
  'hire-sync-jess-wood',
  'app-jess-wood',
  'store-sissys-little-rock',
  'jl-team-jess-wood',
  'user-hiring-manager',
  'synced',
  '{"fullName":"Jess Wood","role":"Sales Manager","gemmatchProfile":"D","courseCredentialIds":["course-credential-jewellink-premium-how-to-jess"]}'::jsonb,
  '2026-06-22T14:30:00.000Z',
  '2026-06-22T14:31:00.000Z'
)
on conflict (application_id) do update set
  jewellink_team_member_id = excluded.jewellink_team_member_id,
  sync_status = excluded.sync_status,
  payload_snapshot = excluded.payload_snapshot,
  synced_at = excluded.synced_at;

insert into domain_events (id, store_id, company_id, actor_user_id, event_type, subject_type, subject_id, payload, created_at)
values
  ('domain-event-demo-seed', 'store-sissys-little-rock', 'co-sissys', null, 'seed.loaded', 'store', 'store-sissys-little-rock', '{"seed":"0001_demo_phase1"}'::jsonb, now()),
  ('domain-event-demo-seed-harbor', 'store-harbor-memphis', 'co-harbor', null, 'seed.loaded', 'store', 'store-harbor-memphis', '{"seed":"0001_demo_phase1","privacyFixture":"same_email_applicant"}'::jsonb, now())
on conflict (id) do nothing;
