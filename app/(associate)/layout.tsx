import { redirect } from "next/navigation";
import { AssociateShell } from "@/components/AssociateShell";
import { getSessionContext } from "@/lib/server/access-control";

export default async function AssociateLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext().catch(() => null);
  if (!session) redirect("/login?next=/portal");
  if (session.role === "admin") redirect("/admin");
  if (session.role === "store_owner" || session.role === "manager") redirect("/dashboard");
  const initials = session.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "JH";
  return (
    <AssociateShell user={{ name: session.name, email: session.email, role: "associate", initials }}>
      {children}
    </AssociateShell>
  );
}
