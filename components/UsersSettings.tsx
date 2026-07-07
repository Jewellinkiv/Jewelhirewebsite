"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import { MANAGER_USERS, ManagerUser, UserRole, ROLE_CAPABILITY } from "@/lib/users";
import { IconUserPlus, IconCheck, IconX, IconLock } from "@/components/icons";

const initialsOf = (n: string) => n.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const input = "border border-line rounded-md px-3 py-2 text-[13px] text-body outline-none focus:border-primary bg-white";

export function UsersSettings({ storeId }: { storeId: string }) {
  const [users, setUsers] = useState<ManagerUser[]>(MANAGER_USERS);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("Supervisor");
  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stores/${storeId}/users`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { items: ManagerUser[] }) => {
        if (!cancelled) setUsers(data.items);
      })
      .catch(() => {
        if (!cancelled) setUsers(MANAGER_USERS);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const addUser = async () => {
    if (!name.trim() || !email.trim()) return;
    const response = await fetch(`/api/stores/${storeId}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), role }),
    });
    if (!response.ok) {
      setNotice("Invite could not be sent locally.");
      return;
    }
    const data = await response.json() as { users: ManagerUser[]; user: ManagerUser };
    setUsers(data.users);
    setNotice(`Invite sent to ${data.user.email} as ${data.user.role}.`);
    setName(""); setEmail(""); setRole("Supervisor");
  };

  const removeUser = async (id: string) => {
    const response = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setNotice("User could not be removed locally.");
      return;
    }
    const data = await response.json() as { users: ManagerUser[] };
    setUsers(data.users);
    setNotice("User removed.");
  };

  const transferAdmin = async (id: string) => {
    const target = users.find((x) => x.id === id);
    const response = await fetch(`/api/stores/${storeId}/transfer-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId: id }),
    });
    if (!response.ok) {
      setNotice("Admin could not be transferred locally.");
      return;
    }
    const data = await response.json() as { users: ManagerUser[] };
    setUsers(data.users);
    setNotice(`${target?.name} is now the Admin. You are now a Supervisor.`);
    setConfirming(null);
  };

  const admin = users.find((u) => u.role === "Admin");

  return (
    <Panel title="Users & roles" icon={<IconLock size={16} />} className="mb-[18px]">
      <div className="p-4">
        {notice && (
          <div className="mb-3 flex items-center gap-2 bg-[#e1f5ee] border border-[#cdeadd] text-[#0f6e56] rounded-md px-3 py-2 text-[12.5px]">
            <IconCheck size={14} /> {notice}
            <button onClick={() => setNotice("")} className="ml-auto text-[#0f6e56]/70 hover:text-[#0f6e56]"><IconX size={14} /></button>
          </div>
        )}

        {/* add user */}
        <div className="flex flex-wrap items-end gap-2.5 mb-4">
          <div className="flex flex-col">
            <label className="text-[11.5px] font-medium text-head mb-1">Name</label>
            <input className={input} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label className="text-[11.5px] font-medium text-head mb-1">Email</label>
            <input className={input} type="email" placeholder="name@store.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label className="text-[11.5px] font-medium text-head mb-1">Role</label>
            <select className={input} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              <option value="Supervisor">Supervisor</option>
              <option value="Admin">Admin (transfers ownership)</option>
            </select>
          </div>
          <button onClick={addUser} className="btn-grad inline-flex items-center gap-1.5 px-4 py-2 text-[13px]"><IconUserPlus size={15} /> Add user</button>
        </div>

        {/* roles legend */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {(["Admin", "Supervisor"] as UserRole[]).map((r) => (
            <div key={r} className="rounded-md border border-line bg-page px-3 py-2">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r === "Admin" ? "bg-[#efe9fd] text-[#5a44c9]" : "bg-[#e8f1ff] text-primary"}`}>{r}</span>
              <span className="text-[12px] text-muted ml-2">{ROLE_CAPABILITY[r]}</span>
            </div>
          ))}
        </div>

        {/* user list */}
        <div className="border border-line rounded-md divide-y divide-[#eef1f6]">
          {users.map((u) => {
            const isAdmin = u.role === "Admin";
            return (
              <div key={u.id} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                <span className="w-9 h-9 rounded-full bg-[#eef2f7] flex items-center justify-center text-[12px] font-semibold text-[#5b6472]">{initialsOf(u.name)}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-medium text-head">{u.name}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isAdmin ? "bg-[#efe9fd] text-[#5a44c9]" : "bg-[#e8f1ff] text-primary"}`}>{u.role}</span>
                    {u.status === "Invited" && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#fff4e2] text-[#9a6a12]">Invited</span>}
                  </div>
                  <div className="text-[12px] text-muted">{u.email}</div>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  {isAdmin ? (
                    <span className="text-[11.5px] text-muted">Owner</span>
                  ) : confirming === u.id ? (
                    <>
                      <span className="text-[11.5px] text-muted">Transfer admin?</span>
                      <button onClick={() => transferAdmin(u.id)} className="text-[12px] px-2.5 py-1 rounded-md btn-grad">Confirm</button>
                      <button onClick={() => setConfirming(null)} className="text-[12px] px-2.5 py-1 rounded-md border border-line text-body hover:bg-rowhover">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setConfirming(u.id)} className="text-[12px] px-2.5 py-1 rounded-md border border-line text-body hover:bg-rowhover">Make admin</button>
                      <button onClick={() => removeUser(u.id)} title="Remove user" className="w-8 h-8 rounded-md border border-line text-muted hover:bg-[#fcebeb] hover:text-[#a32d2d] flex items-center justify-center"><IconX size={15} /></button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11.5px] text-muted mt-2">One Admin at a time. Transferring admin makes {admin?.name} a Supervisor.</p>
      </div>
    </Panel>
  );
}
