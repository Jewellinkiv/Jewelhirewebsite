import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/server/access-control";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext().catch(() => null);
  if (!session) redirect("/login?next=/settings");
  if (session.role === "admin") redirect("/admin");
  if (session.role === "associate") redirect("/portal");
  if (session.storeRoles[session.activeStoreId] !== "store_owner") redirect("/dashboard");
  return children;
}
