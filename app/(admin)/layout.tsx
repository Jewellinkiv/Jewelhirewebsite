import { redirect } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { getSessionContext } from "@/lib/server/access-control";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate: only admins reach /admin/*. Non-admins (store owners /
  // applicants) previously saw the empty admin shell before the APIs 403'd.
  const session = await getSessionContext().catch(() => null);
  if (!session) redirect("/login?next=/admin");
  if (session.role !== "admin") redirect(session.role === "associate" ? "/portal" : "/dashboard");
  return <AdminShell>{children}</AdminShell>;
}
