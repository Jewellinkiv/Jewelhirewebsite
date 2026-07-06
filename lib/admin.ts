// JewelHire internal admin (cross-company). Mock data. This is the ONLY surface
// that spans companies — every store-owner request stays store-scoped elsewhere.

export type PlanTier = "Starter" | "Growth" | "Pro";
export type CompanyStatus = "Active" | "Trial" | "Suspended";

export interface AdminStore {
  id: string;
  name: string;
  location: string;
}

export interface AdminCompanyUser {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Supervisor";
  status: "Active" | "Invited";
}

export interface AdminCompany {
  id: string;
  name: string;
  owner: string;
  plan: PlanTier;
  status: CompanyStatus;
  createdAt: string;
  stores: AdminStore[];
  users: AdminCompanyUser[];
  seats: number;
  assessmentsSent: number;
  hires: number;
}

export const COMPANIES: AdminCompany[] = [
  {
    id: "co-sissys", name: "Sissy's Log Cabin", owner: "William Jones", plan: "Pro", status: "Active", createdAt: "Jan 2026",
    seats: 8, assessmentsSent: 142, hires: 6,
    stores: [
      { id: "lr", name: "Little Rock", location: "Little Rock, AR" },
      { id: "mem", name: "Memphis", location: "Memphis, TN" },
      { id: "jon", name: "Jonesboro", location: "Jonesboro, AR" },
    ],
    users: [
      { id: "u1", name: "William Jones", email: "william@sissyslogcabin.com", role: "Admin", status: "Active" },
      { id: "u2", name: "Maria King", email: "maria@sissyslogcabin.com", role: "Supervisor", status: "Active" },
    ],
  },
  {
    id: "co-harbor", name: "Harbor Gold", owner: "Leo Park", plan: "Growth", status: "Active", createdAt: "Mar 2026",
    seats: 4, assessmentsSent: 63, hires: 3,
    stores: [{ id: "h1", name: "Memphis Flagship", location: "Memphis, TN" }],
    users: [{ id: "u3", name: "Leo Park", email: "leo@harborgold.com", role: "Admin", status: "Active" }],
  },
  {
    id: "co-sterling", name: "Sterling & Vine", owner: "Dana Cole", plan: "Starter", status: "Trial", createdAt: "Jun 2026",
    seats: 2, assessmentsSent: 11, hires: 0,
    stores: [{ id: "s1", name: "Hillcrest", location: "Little Rock, AR" }],
    users: [{ id: "u4", name: "Dana Cole", email: "dana@sterlingvine.com", role: "Admin", status: "Active" }],
  },
  {
    id: "co-northpoint", name: "Northpoint Diamonds", owner: "Ray Best", plan: "Growth", status: "Suspended", createdAt: "Nov 2025",
    seats: 3, assessmentsSent: 88, hires: 4,
    stores: [{ id: "n1", name: "Rogers", location: "Rogers, AR" }],
    users: [{ id: "u5", name: "Ray Best", email: "ray@northpoint.com", role: "Admin", status: "Active" }],
  },
];

export interface Plan {
  tier: PlanTier;
  price: string;
  seats: string;
  features: string[];
}

export const PLANS: Plan[] = [
  { tier: "Starter", price: "$49/mo", seats: "Up to 2 seats", features: ["JewelCert", "1 store", "Email invites"] },
  { tier: "Growth", price: "$149/mo", seats: "Up to 5 seats", features: ["Everything in Starter", "Up to 3 stores", "Custom assessments", "Calendar sync"] },
  { tier: "Pro", price: "$349/mo", seats: "Unlimited seats", features: ["Everything in Growth", "Unlimited stores", "Priority support", "Analytics"] },
];

export interface Invoice {
  id: string;
  company: string;
  amount: string;
  date: string;
  status: "Paid" | "Due" | "Past due";
}

export const INVOICES: Invoice[] = [
  { id: "INV-2041", company: "Sissy's Log Cabin", amount: "$349.00", date: "Jun 1, 2026", status: "Paid" },
  { id: "INV-2042", company: "Harbor Gold", amount: "$149.00", date: "Jun 1, 2026", status: "Paid" },
  { id: "INV-2043", company: "Sterling & Vine", amount: "$0.00", date: "Jun 18, 2026", status: "Due" },
  { id: "INV-2039", company: "Northpoint Diamonds", amount: "$149.00", date: "May 1, 2026", status: "Past due" },
];

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: string;
}

export const AUDIT_LOG: AuditEntry[] = [
  { id: "a1", actor: "you", action: "Viewed as", target: "Sissy's Log Cabin", at: "Today 10:14" },
  { id: "a2", actor: "you", action: "Changed plan", target: "Harbor Gold → Growth", at: "Jun 20" },
  { id: "a3", actor: "system", action: "Suspended (payment)", target: "Northpoint Diamonds", at: "Jun 12" },
];

export function adminMetrics() {
  const stores = COMPANIES.reduce((n, c) => n + c.stores.length, 0);
  const sent = COMPANIES.reduce((n, c) => n + c.assessmentsSent, 0);
  const hires = COMPANIES.reduce((n, c) => n + c.hires, 0);
  return {
    companies: COMPANIES.length,
    active: COMPANIES.filter((c) => c.status === "Active").length,
    stores,
    assessmentsSent: sent,
    hires,
  };
}

export const STATUS_STYLE: Record<CompanyStatus, string> = {
  Active: "bg-[#e1f5ee] text-[#0f6e56]",
  Trial: "bg-[#e8f1ff] text-primary",
  Suspended: "bg-[#fcebeb] text-[#a32d2d]",
};

export const PLAN_STYLE: Record<PlanTier, string> = {
  Starter: "bg-[#eef2f7] text-[#5b6472]",
  Growth: "bg-[#e8f1ff] text-primary",
  Pro: "bg-[#efe9fd] text-[#5a44c9]",
};
