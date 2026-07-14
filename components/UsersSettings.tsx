"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import { MANAGER_USERS, ManagerUser, UserRole, ROLE_CAPABILITY } from "@/lib/users";
import { IconUserPlus, IconCheck, IconX, IconLock } from "@/components/icons";

const initialsOf = (n: string) => n.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const input = "border border-line rounded-md px-3 py-2 text-[13px] text-body outline-none focus:border-primary bg-white";
const invitesPausedMessage = "Team onboarding is temporarily unavailable while JewelHire completes secure invitation setup.";

async function apiErrorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return typeof body?.error?.message === "string" ? body.error.message : fallback;
}

export function UsersSettings({ storeId }: { storeId: string }) {
  const [users, setUsers] = useState<ManagerUser[]>(MANAGER_USERS);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("Supervisor");
  const [notice, setNotice] = useState("");
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [teamInvitesEnabled, setTeamInvitesEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stores/${storeId}/users`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { items: ManagerUser[]; capabilities?: { teamInvitesEnabled?: boolean } }) => {
        if (!cancelled) {
          setUsers(data.items);
          setTeamInvitesEnabled(data.capabilities?.teamInvitesEnabled === true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUsers(MANAGER_USERS);
          setTeamInvitesEnabled(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const addUser = async () => {
    if (!teamInvitesEnabled) {
      setNotice(invitesPausedMessage);
      setNoticeIsError(true);
      return;
    }
    if (!name.trim() || !email.trim()) return;
    const response = await fetch(`/api/stores/${storeId}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), role }),
    });
    if (!response.ok) {
      setNotice(await apiErrorMessage(response, "The invitation could not be created."));
      setNoticeIsError(true);
      return;
    }
    const data = await response.json() as {
      users: ManagerUser[];
      user: ManagerUser;
      notification?: { status?: string; delivery?: string };
    };
    setUsers(data.users);
    setNotice(
      data.notification?.status === "sent" && data.notification.delivery === "accepted"
        ? `Invitation email accepted for delivery to ${data.user.email}.`
        : `${data.user.email} was added as Invited, but no invitation email was sent.`,
    );
    setNoticeIsError(data.notification?.status !== "sent" || data.notification.delivery !== "accepted");
    setName(""); setEmail(""); setRole("Supervisor");
  };

  const removeUser = async (id: string) => {
    const response = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setNotice(await apiErrorMessage(response, "The user could not be removed."));
      setNoticeIsError(true);
      return;
    }
    const data = await response.json() as { users: ManagerUser[] };
    setUsers(data.users);
    setNotice("User removed.");
    setNoticeIsError(false);
  };

  const transferAdmin = async (id: string) => {
    if (!teamInvitesEnabled) {
      setNotice(invitesPausedMessage);
      setNoticeIsError(true);
      setConfirming(null);
      return;
    }
    const target = users.find((x) => x.id === id);
    const response = await fetch(`/api/stores/${storeId}/transfer-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId: id }),
    });
    if (!response.ok) {
      setNotice(await apiErrorMessage(response, "Store ownership could not be transferred."));
      setNoticeIsError(true);
      return;
    }
    const data = await response.json() as { users: ManagerUser[] };
    setUsers(data.users);
    setNotice(`${target?.name} is now the Admin. You are now a Supervisor.`);
    setNoticeIsError(false);
    setConfirming(null);
  };

  const admin = users.find((u) => u.role === "Admin");

  return (
    <Panel title="Users & roles" icon={<IconLock size={16} />} className="mb-[18px]">
      <div className="p-4">
        {notice && (
          <div className={`mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-[12.5px] ${noticeIsError ? "bg-[#fff4e2] border border-[#f1ddb6] text-[#7a5610]" : "bg-[#e1f5ee] border border-[#cdeadd] text-[#0f6e56]"}`}>
            <IconCheck size={14} /> {notice}
            <button onClick={() => setNotice("")} className="ml-auto opacity-70 hover:opacity-100"><IconX size={14} /></button>
          </div>
        )}

        {!teamInvitesEnabled && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-[#cfe0fb] bg-[#eef4ff] px-3 py-2.5 text-[12.5px] text-body">
            <IconLock size={15} className="mt-0.5 shrink-0 text-primary" />
            <div><span className="font-medium text-head">Team onboarding is paused.</span> Existing users remain visible and can still be removed. Invites and ownership changes will return after secure acceptance is ready.</div>
          </div>
        )}

        {/* add user */}
        <div className="flex flex-wrap items-end gap-2.5 mb-4">
          <div className="flex flex-col">
            <label className="text-[11.5px] font-medium text-head mb-1">Name</label>
            <input disabled={!teamInvitesEnabled} className={`${input} disabled:bg-page disabled:text-muted`} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label className="text-[11.5px] font-medium text-head mb-1">Email</label>
            <input disabled={!teamInvitesEnabled} className={`${input} disabled:bg-page disabled:text-muted`} type="email" placeholder="name@store.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label className="text-[11.5px] font-medium text-head mb-1">Role</label>
            <select disabled={!teamInvitesEnabled} className={`${input} disabled:bg-page disabled:text-muted`} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              <option value="Supervisor">Supervisor</option>
              <option value="Admin">Admin (transfers ownership)</option>
            </select>
          </div>
          <button disabled={!teamInvitesEnabled} onClick={addUser} className="btn-grad inline-flex items-center gap-1.5 px-4 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"><IconUserPlus size={15} /> {teamInvitesEnabled ? "Add user" : "Invites paused"}</button>
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
                  ) : !teamInvitesEnabled ? (
                    <>
                      <span className="text-[11.5px] text-muted">Role changes paused</span>
                      <button onClick={() => removeUser(u.id)} title="Remove user" className="w-8 h-8 rounded-md border border-line text-muted hover:bg-[#fcebeb] hover:text-[#a32d2d] flex items-center justify-center"><IconX size={15} /></button>
                    </>
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
        <p className="text-[11.5px] text-muted mt-2">{teamInvitesEnabled ? `One Admin at a time. Transferring admin makes ${admin?.name} a Supervisor.` : "Invites, role changes, and ownership transfers are disabled for the pilot."}</p>
      </div>
    </Panel>
  );
}
