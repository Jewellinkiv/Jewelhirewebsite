// Team members who can manage JewelHire. One Admin (owner) at a time; others are
// Supervisors. Admin can be transferred to a Supervisor. Mock data.

export type UserRole = "Admin" | "Supervisor";

export interface ManagerUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "Active" | "Invited";
}

export const MANAGER_USERS: ManagerUser[] = [
  { id: "u1", name: "William Jones", email: "william@sissyslogcabin.com", role: "Admin", status: "Active" },
  { id: "u2", name: "Maria King", email: "maria@sissyslogcabin.com", role: "Supervisor", status: "Active" },
  { id: "u3", name: "Leo Park", email: "leo@sissyslogcabin.com", role: "Supervisor", status: "Active" },
  { id: "u4", name: "Priya Shah", email: "priya@sissyslogcabin.com", role: "Supervisor", status: "Invited" },
];

export const ROLE_CAPABILITY: Record<UserRole, string> = {
  Admin: "Full access — manage users, billing, settings, and all hiring.",
  Supervisor: "Manage hiring, candidates, interviews, and team — no billing or user management.",
};
