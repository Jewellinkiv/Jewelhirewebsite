import { redirect } from "next/navigation";
import { AssociateShell } from "@/components/AssociateShell";
import { getSessionContext } from "@/lib/server/access-control";

export default async function AssociateLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext().catch(() => null);
  if (!session) redirect("/login?next=/portal");
  if (session.role === "admin") redirect("/admin");
  if (session.role === "store_owner" || session.role === "manager") redirect("/");
  return <AssociateShell>{children}</AssociateShell>;
}
