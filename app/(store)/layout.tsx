import { AppShell } from "@/components/AppShell";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
