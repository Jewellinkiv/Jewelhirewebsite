# JewelHire v2 Direction

## Intent

JewelHire v2 should be a clean rebuild, not a Bubble database migration. The old Bubble app is useful for discovery, but the new product should share the same product system, infrastructure shape, and visual language as JewelLink and LinkD, with LinkD acting as the strongest brand/design reference.

## Source Notes

### Claude Discovery

Claude has started a GemMatch handoff package around a jewelry-native personality and team-fit system:

- Five-minute maximum assessment.
- Single-pass adjective selection instead of a Predictive Index-style two-pass flow.
- Candidate chooses roughly 10 words from a pool of about 48.
- Four measured dimensions remain underneath the scoring model.
- Results expand into about 12 named primary-to-secondary profile types.
- Reports should support individual insight, management guidance, floor fit, team composition, and applicant-vs-team fit.
- Hiring loop should support syncing existing team members from JewelLink, assessing applicants, then hiring and adding them to the team.
- Fit rating should blend role fit and team gap fit, shown as simple tiers such as Strong, Good, Stretch, and Poor.
- Open dependency: JewelLink identity/account sync details.

### Bubble App Discovery

The current Bubble app is organized around many reusable elements and role-specific page modules:

- Admin pages: aptitude tests, courses, jobs, reviews, users.
- Store pages: certs, candidates, candidate profile, jobs, my team, reviews/ratings, store profile, subscription.
- Job seeker pages: certs, chatbot, profile, jobs, notifications, posts.
- Shared pieces: admin/store/user sidebars, chat/chatbot, training center, support, popups.

For v2, this should become a smaller set of deeper product modules rather than page-for-page recreation.

## Product Shape

### Keep

- Multi-role experience: platform/admin, store/hiring manager, applicant/team member.
- Cert/test invitation workflow.
- Candidate status and review workflow.
- Team/member roster concepts.
- Training/course capability if it supports hiring, onboarding, or performance.
- Reviews only if they directly support hiring/profile credibility.

### Drop Or Deprioritize

- Social posts.
- Calendly/video support modules unless needed for core onboarding.
- Bubble-era duplicate sidebars and parallel pages.
- Historical data migration except for small samples needed to validate workflows.

### Add

- GemMatch assessment as a first-class product module.
- Existing team assessment and team map.
- Applicant-vs-team fit report.
- Role profile templates for jewelry positions.
- Hire-to-team flow that recomputes team composition.
- JewelLink identity/sync layer.

## Design System Direction

JewelHire v2 should feel like a sibling product to LinkD/JewelLink, not like the current Bubble UI.

### Reference Tokens

From JewelLink:

- Primary blue: `#4681F4`
- Primary dark: `#3a6fd8`
- Primary light: `#5a8ff7`
- Text: `#272727`
- Muted text: `#999999`
- App background: `#F7F7F9`
- Card surface: `#FFFFFF`
- Card radius: `8px`
- Main font: Poppins

From LinkD's default organization theme:

- Page background: `#f4f7fb`
- Panel background: `#ffffff`
- Panel border: `#c2cfe0`
- Header text: `#0f172a`
- Body text: `#243447`
- Muted text: `#64748b`
- Icon accent / primary action: `#4a90e2`
- Row hover: `#edf5ff`
- Button hover: `#3576c8`

Recommendation: use the LinkD organization theme shape for JewelHire v2, with JewelLink's `#4681F4` blue as the default product primary unless the LinkD shell owns the product.

### Visual Language

- Use a soft blue/white operational background.
- Use compact white panels with subtle borders and restrained shadows.
- Keep corners modest, around 6-8px for cards and controls.
- Use a blue primary action style consistent with LinkD/JewelLink.
- Prefer dense, scannable dashboard layouts over marketing-style cards.
- Use clear status chips for candidate/test states.
- Use small, functional icons in navigation and action buttons.
- Keep type practical: strong dark headings, small uppercase section labels where useful, clean body text.

### Product Shell

Recommended shell:

- Left navigation grouped by role/workflow.
- Top bar with workspace/store context, notifications, account menu, and primary action.
- Main content as task-focused work surfaces: tables, reports, panels, and detail drawers.
- Avoid nested cards. Use full-width page bands and individual cards only for repeated records or report panels.

### Candidate/Store Experience

The candidate-facing experience can be warmer, but should still share tokens:

- Simple invitation landing page.
- Short assessment screen.
- Progress and completion states.
- Result preview when appropriate.

## Infrastructure Direction

Match JewelLink/LinkD patterns where possible:

- JewelLink reference stack: Next 14, React 18, TypeScript, Tailwind, Prisma, NextAuth, Postgres, Postmark, Stripe, Twilio, OpenAI, Recharts.
- LinkD reference stack: .NET 10, ServiceStack, EF Core, PostgreSQL/SQLite, ServiceStack Jobs, ServiceStack AI Chat, Vue 3, Vite, Tailwind 4, Pinia, ServiceStack DTOs, ECharts, Playwright/Vitest.
- The infrastructure choice should be intentional:
  - If JewelHire is closest to JewelLink Academy and hiring/training/accounts, build on the JewelLink-style Next/Prisma/NextAuth stack.
  - If JewelHire should live beside LinkD operational tooling and share org/store infrastructure, build on the LinkD ServiceStack + Vue stack.
  - If it needs both, make JewelHire its own app but align identity, organization, stores, and theme contracts with LinkD/JewelLink.
- Shared authentication/identity concept with JewelLink.
- Organization/store/team membership as core data, not Bubble page state.
- Role-based access: admin, store owner/manager, team member/applicant.
- Organization theming should be a data-backed concept like LinkD's `ViewTheme`/`OrgThemeDto`, not just hardcoded styles.
- Modular product domains:
  - Identity and organizations
  - Stores and teams
  - Candidates and applications
  - Assessments and GemMatch scoring
  - Cert invitations and statuses
  - Reports and recommendations
  - Training/onboarding
  - Integrations/JewelLink sync
- Event-driven records for invites, completions, hiring decisions, and team recomputes.
- Keep the old Bubble app as read-only discovery until v2 has its own source of truth.

## First Build Passes

1. Define the v2 information architecture and role navigation.
2. Define core database entities for orgs, stores, users, candidates, invites, assessments, results, teams, roles, and reports.
3. Create LinkD-style design tokens and app shell.
4. Build the GemMatch assessment prototype.
5. Build individual result, team map, and applicant-vs-team report screens.
6. Build candidate invite and completion flow.
7. Build store manager candidate list and candidate detail review flow.
8. Done: inventory all legacy Bubble aptitude tests, questions, answer options, targets, and point values for v2 seed data.
9. Done: define the v2 assessment data model, scoring rules, and review workflow.
10. Done: first-pass inventory of legacy Bubble courses and course editor structure.
11. Translate legacy aptitude inventory into reviewed v2 assessment seed data.
12. Deep-extract course lessons, tests, and video assets for reviewed v2 training seed data.
13. Add JewelLink sync once identity/account assumptions are known.

## Open Questions

- What is the exact JewelLink auth/session/organization model that JewelHire v2 should share?
- Should JewelHire live as its own app or as a module inside the JewelLink platform shell?
- Which LinkD/JewelLink codebase should be used as the infrastructure reference?
- Should GemMatch results be visible to applicants, store managers only, or both with different levels of detail?
- What are the first jewelry role templates to calibrate: Sales Associate, Bridal Specialist, Store Manager, Bench Jeweler, Appraiser, Admin, Inventory, Marketing?
