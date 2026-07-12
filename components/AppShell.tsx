import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ children, canManageSettings }: { children: ReactNode; canManageSettings: boolean }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar canManageSettings={canManageSettings} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar canManageSettings={canManageSettings} />
        <main className="p-[22px] max-w-[1280px] w-full">{children}</main>
      </div>
    </div>
  );
}
