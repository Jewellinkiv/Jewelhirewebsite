"use client";

import { FormEvent, useMemo, useState } from "react";
import { IconX } from "@/components/icons";
import { Location, TeamMemberLoc } from "@/lib/team-locations";

type CreatedTeamMember = TeamMemberLoc & {
  status?: string;
  location?: string;
  training?: string;
  lastCheckIn?: string;
  nextAction?: string;
};

export function TeamMemberModal({
  open,
  title,
  storeId,
  locations,
  defaultLocationId,
  onClose,
  onCreated,
}: {
  open: boolean;
  title: string;
  storeId: string;
  locations: Location[];
  defaultLocationId?: string;
  onClose: () => void;
  onCreated: (member: CreatedTeamMember) => void;
}) {
  const fallbackLocationId = useMemo(() => defaultLocationId || locations[0]?.id || "", [defaultLocationId, locations]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Sales Associate");
  const [locationId, setLocationId] = useState(fallbackLocationId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/stores/${encodeURIComponent(storeId)}/team`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          role: role.trim() || "Team member",
          locationId: locationId || fallbackLocationId,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.member) throw new Error(data.error || "Team member could not be created.");
      onCreated(data.member);
      setName("");
      setRole("Sales Associate");
      setLocationId(fallbackLocationId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Team member could not be created.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0b1424]/45 flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-[460px] rounded-lg border border-line bg-panel shadow-xl">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <div>
            <h2 className="text-[17px] font-semibold text-head">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-md text-muted hover:bg-rowhover flex items-center justify-center" aria-label="Close">
            <IconX size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <label className="block">
            <span className="block text-[12px] font-medium text-muted mb-1.5">Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-md border border-line px-3 py-2 text-[13px] outline-none focus:border-primary" autoFocus />
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-muted mb-1.5">Role</span>
            <input value={role} onChange={(event) => setRole(event.target.value)} className="w-full rounded-md border border-line px-3 py-2 text-[13px] outline-none focus:border-primary" />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="block">
              <span className="block text-[12px] font-medium text-muted mb-1.5">JewelCert</span>
              <div className="w-full rounded-md border border-line bg-[#f7f9fc] px-3 py-2 text-[13px] text-muted">Not assessed</div>
            </div>
            <label className="block">
              <span className="block text-[12px] font-medium text-muted mb-1.5">Location</span>
              <select value={locationId || fallbackLocationId} onChange={(event) => setLocationId(event.target.value)} className="w-full rounded-md border border-line bg-panel px-3 py-2 text-[13px] outline-none focus:border-primary">
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
            </label>
          </div>
          {error && <div className="rounded-md border border-[#f0c9c9] bg-[#fcebeb] px-3 py-2 text-[12.5px] text-[#a32d2d]">{error}</div>}
        </div>
        <div className="px-5 py-4 border-t border-line flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-md border border-line text-[13px] text-body hover:bg-rowhover">Cancel</button>
          <button type="submit" disabled={saving} className="btn-grad px-4 py-2 text-[13px] disabled:opacity-60">{saving ? "Saving..." : "Add member"}</button>
        </div>
      </form>
    </div>
  );
}
