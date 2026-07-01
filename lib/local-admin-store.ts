import { AUDIT_LOG, AdminCompany, AdminCompanyUser, COMPANIES, CompanyStatus, INVOICES, PLANS, PlanTier, adminMetrics } from "./admin";

export interface AdminAssessmentDefault {
  id: string;
  name: string;
  kind: "Trait profile" | "Aptitude" | "Knowledge check";
  scope: string;
  status: "Published" | "Draft";
  questions: number;
  note: string;
}

export interface AdminAuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: string;
  metadata?: Record<string, string>;
}

interface AdminState {
  companies: AdminCompany[];
  auditLog: AdminAuditEntry[];
  assessments: AdminAssessmentDefault[];
}

declare global {
  // eslint-disable-next-line no-var
  var __jewelhireAdminStore: AdminState | undefined;
}

const ADMIN_ASSESSMENTS: AdminAssessmentDefault[] = [
  {
    id: "gemmatch",
    name: "GemMatch",
    kind: "Trait profile",
    scope: "All plans",
    status: "Published",
    questions: 48,
    note: "The core pick-10 profile. Default for every company.",
  },
  {
    id: "apt-num",
    name: "Numerical Reasoning",
    kind: "Aptitude",
    scope: "Growth & Pro",
    status: "Published",
    questions: 20,
    note: "Legacy aptitude battery, seeded for v2.",
  },
  {
    id: "know-diamond",
    name: "Diamond Knowledge",
    kind: "Knowledge check",
    scope: "All plans",
    status: "Published",
    questions: 15,
    note: "4Cs and grading fundamentals.",
  },
  {
    id: "pers-sales",
    name: "Sales Personality",
    kind: "Trait profile",
    scope: "Pro",
    status: "Draft",
    questions: 30,
    note: "Extended selling-style inventory.",
  },
];

const PROTECTED_COMPANY_IDS = new Set(["co-sissys", "co-harbor", "co-sterling", "co-northpoint"]);

function cloneCompany(company: AdminCompany): AdminCompany {
  return {
    ...company,
    stores: company.stores.map((store) => ({ ...store })),
    users: company.users.map((user) => ({ ...user })),
  };
}

function nowLabel() {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28);
}

function state(): AdminState {
  if (!globalThis.__jewelhireAdminStore) {
    globalThis.__jewelhireAdminStore = {
      companies: COMPANIES.map(cloneCompany),
      auditLog: AUDIT_LOG.map((entry) => ({ ...entry })),
      assessments: ADMIN_ASSESSMENTS.map((assessment) => ({ ...assessment })),
    };
  }
  return globalThis.__jewelhireAdminStore;
}

export function listAdminCompanies(query = "") {
  const q = query.trim().toLowerCase();
  const companies = state().companies;
  return (q
    ? companies.filter((company) => company.name.toLowerCase().includes(q) || company.owner.toLowerCase().includes(q))
    : companies
  ).map(cloneCompany);
}

export function getAdminCompany(id: string) {
  const company = state().companies.find((item) => item.id === id);
  return company ? cloneCompany(company) : undefined;
}

export function createAdminCompany(input: { name: string; owner: string; plan: PlanTier; ownerEmail?: string }) {
  const idBase = slugify(input.name) || `co-${Date.now()}`;
  const companies = state().companies;
  const id = companies.some((company) => company.id === idBase) ? `${idBase}-${Date.now().toString(36)}` : idBase;
  const ownerEmail = input.ownerEmail?.trim() || `${id}-owner@example.invalid`;
  const company: AdminCompany = {
    id,
    name: input.name.trim(),
    owner: input.owner.trim(),
    plan: input.plan,
    status: "Trial",
    createdAt: "Just now",
    stores: [],
    users: [{ id: `user-${id}-owner`, name: input.owner.trim(), email: ownerEmail, role: "Admin", status: "Invited" }],
    seats: 1,
    assessmentsSent: 0,
    hires: 0,
  };
  companies.unshift(company);
  addAdminAudit("you", "Created company", company.name, { companyId: company.id, plan: company.plan });
  return cloneCompany(company);
}

export function updateAdminCompany(id: string, input: { plan?: PlanTier; status?: CompanyStatus }) {
  const company = state().companies.find((item) => item.id === id);
  if (!company) return undefined;
  if (input.plan) company.plan = input.plan;
  if (input.status) company.status = input.status;
  addAdminAudit("you", "Updated company", company.name, { companyId: company.id });
  return cloneCompany(company);
}

export function removeAdminCompany(id: string) {
  if (PROTECTED_COMPANY_IDS.has(id)) return undefined;
  const companies = state().companies;
  const index = companies.findIndex((item) => item.id === id);
  if (index === -1) return undefined;
  const [company] = companies.splice(index, 1);
  addAdminAudit("you", "Deleted company", company.name, { companyId: company.id });
  return { company: cloneCompany(company), deleted: true };
}

export function inviteAdminCompanyUser(companyId: string, input: { name: string; email: string; role?: AdminCompanyUser["role"] }) {
  const company = state().companies.find((item) => item.id === companyId);
  if (!company) return undefined;
  const user: AdminCompanyUser = {
    id: `user-${companyId}-${Date.now().toString(36)}`,
    name: input.name.trim(),
    email: input.email.trim(),
    role: input.role ?? "Supervisor",
    status: "Invited",
  };
  company.users.push(user);
  company.seats = Math.max(company.seats, company.users.length);
  addAdminAudit("you", "Invited user", `${user.email} at ${company.name}`, { companyId, userId: user.id });
  return { company: cloneCompany(company), user: { ...user } };
}

export function updateAdminUser(userId: string, input: { role?: AdminCompanyUser["role"]; status?: AdminCompanyUser["status"] }) {
  for (const company of state().companies) {
    const user = company.users.find((item) => item.id === userId);
    if (!user) continue;
    if (input.role) user.role = input.role;
    if (input.status) user.status = input.status;
    addAdminAudit("you", "Updated user", `${user.email} at ${company.name}`, { companyId: company.id, userId });
    return { company: cloneCompany(company), user: { ...user } };
  }
  return undefined;
}

export function removeAdminUser(userId: string) {
  for (const company of state().companies) {
    const user = company.users.find((item) => item.id === userId);
    if (!user || user.role === "Admin") continue;
    company.users = company.users.filter((item) => item.id !== userId);
    addAdminAudit("you", "Removed user", `${user.email} from ${company.name}`, { companyId: company.id, userId });
    return { company: cloneCompany(company), user: { ...user } };
  }
  return undefined;
}

export function resendAdminUserInvite(userId: string) {
  for (const company of state().companies) {
    const user = company.users.find((item) => item.id === userId);
    if (!user) continue;
    addAdminAudit("you", "Resent invite", `${user.email} at ${company.name}`, { companyId: company.id, userId });
    return { company: cloneCompany(company), user: { ...user } };
  }
  return undefined;
}

export function startAdminImpersonation(companyId: string) {
  const company = state().companies.find((item) => item.id === companyId);
  if (!company) return undefined;
  const audit = addAdminAudit("you", "Viewed as", company.name, { companyId });
  return {
    company: cloneCompany(company),
    session: {
      id: `imp-${company.id}-${Date.now().toString(36)}`,
      mode: "view_as",
      startedAt: new Date().toISOString(),
      auditId: audit.id,
    },
  };
}

export function listAdminAuditLog() {
  return state().auditLog.map((entry) => ({ ...entry }));
}

export function listAdminAssessments() {
  return state().assessments.map((assessment) => ({ ...assessment }));
}

export function getAdminOverview() {
  const metrics = adminMetricsFor(state().companies);
  return {
    metrics,
    recentCompanies: state().companies.slice(0, 4).map(cloneCompany),
    auditLog: listAdminAuditLog().slice(0, 5),
  };
}

export function getAdminBilling() {
  const companies = state().companies;
  const mrr = companies.reduce((sum, company) => sum + planPrice(company.plan) * (company.status === "Active" ? 1 : 0), 0);
  const byPlan = (["Starter", "Growth", "Pro"] as PlanTier[]).map((tier) => ({
    tier,
    count: companies.filter((company) => company.plan === tier).length,
  }));
  return {
    mrr,
    byPlan,
    plans: PLANS.map((plan) => ({ ...plan, features: [...plan.features] })),
    invoices: INVOICES.map((invoice) => ({ ...invoice })),
  };
}

export function getAdminAnalytics() {
  const companies = state().companies;
  const metrics = adminMetricsFor(companies);
  const maxSent = Math.max(...companies.map((company) => company.assessmentsSent), 1);
  const funnel = [
    { key: "Assessments sent", value: metrics.assessmentsSent },
    { key: "Completed", value: Math.round(metrics.assessmentsSent * 0.78) },
    { key: "Interviewed", value: Math.round(metrics.assessmentsSent * 0.31) },
    { key: "Hired", value: metrics.hires },
  ];
  return {
    metrics,
    funnel,
    fitDistribution: [
      { key: "Strong fit", value: 38 },
      { key: "Good fit", value: 41 },
      { key: "Stretch", value: 15 },
      { key: "Poor fit", value: 6 },
    ],
    assessmentsByCompany: companies.map((company) => ({
      companyId: company.id,
      name: company.name,
      value: company.assessmentsSent,
      pctOfMax: Math.round((company.assessmentsSent / maxSent) * 100),
    })),
    adoptionByPlan: (["Starter", "Growth", "Pro"] as PlanTier[]).map((tier) => ({
      tier,
      count: companies.filter((company) => company.plan === tier).length,
    })),
  };
}

export function getAdminSupport(query = "") {
  return {
    companies: listAdminCompanies(query),
    auditLog: listAdminAuditLog(),
  };
}

function addAdminAudit(actor: string, action: string, target: string, metadata?: Record<string, string>) {
  const entry: AdminAuditEntry = {
    id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    actor,
    action,
    target,
    at: nowLabel(),
    metadata,
  };
  state().auditLog.unshift(entry);
  return entry;
}

function adminMetricsFor(companies: AdminCompany[]) {
  const stores = companies.reduce((n, company) => n + company.stores.length, 0);
  const sent = companies.reduce((n, company) => n + company.assessmentsSent, 0);
  const hires = companies.reduce((n, company) => n + company.hires, 0);
  return {
    companies: companies.length,
    active: companies.filter((company) => company.status === "Active").length,
    stores,
    assessmentsSent: sent,
    hires,
  };
}

function planPrice(plan: PlanTier) {
  if (plan === "Pro") return 349;
  if (plan === "Growth") return 149;
  return 49;
}
