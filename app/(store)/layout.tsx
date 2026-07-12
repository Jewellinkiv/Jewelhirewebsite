import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getSessionContext } from "@/lib/server/access-control";

// Server-side role gate for the store shell. Platform admins live entirely in
// the admin panel (/admin) and applicants in the portal (/portal); only store
// owners/managers see the store dashboard. Without this, an admin could wander
// into store routes and the store "Dashboard" button would bounce them to /admin.
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext().catch(() => null);
  if (!session) redirect("/login?next=/");
  if (session.role === "admin") redirect("/admin");
  if (session.role === "associate") redirect("/portal");
  return <AppShell canManageSettings={session.storeRoles[session.activeStoreId] === "store_owner"}>{children}</AppShell>;
}
