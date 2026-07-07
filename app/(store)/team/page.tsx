"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common";
import { TeamMemberModal } from "@/components/TeamMemberModal";
import { Panel, TypeLabel } from "@/components/ui";
import { Location, TeamMemberLoc } from "@/lib/team-locations";
import { IconSend, IconX, IconUserPlus, IconMapPin } from "@/components/icons";
import { useActiveStoreId } from "@/lib/client-session";

export default function TeamPage() {
  const STORE_ID = useActiveStoreId("store-sissys-little-rock");
  const [members, setMembers] = useState<TeamMemberLoc[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loc, setLoc] = useState<string>("all");
  const [adding, setAdding] = useState(false);

  const visible = loc === "all" ? members : members.filter((m) => m.locationId === loc);
  const countAt = (id: string) => members.filter((m) => m.locationId === id).length;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/stores/${STORE_ID}/locations`).then((response) => (response.ok ? response.json() : Promise.reject())),
      fetch(`/api/stores/${STORE_ID}/team`).then((response) => (response.ok ? response.json() : Promise.reject())),
    ])
      .then(([locationsData, teamData]: [{ items: Location[] }, { members: TeamMemberLoc[] }]) => {
        if (cancelled) return;
        setLocations(locationsData.items);
        setMembers(teamData.members);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [STORE_ID]);

  const reassign = async (mid: string, locationId: string) => {
    setMembers((ms) => ms.map((m) => (m.id === mid ? { ...m, locationId } : m)));
    await fetch(`/api/team-members/${mid}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locationId }),
    }).catch(() => undefined);
  };
  const remove = async (mid: string) => {
    setMembers((ms) => ms.filter((m) => m.id !== mid));
    await fetch(`/api/team-members/${mid}`, { method: "DELETE" }).catch(() => undefined);
  };

  const selectedLoc = locations.find((l) => l.id === loc);

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Your associates across locations. Reassign locations, send a JewelCert, or remove."
        action={<button onClick={() => setAdding(true)} className="btn-grad inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px]"><IconUserPlus size={16} /> Invite member</button>}
      />
      <TeamMemberModal
        open={adding}
        title="Invite member"
        locations={locations}
        defaultLocationId={loc === "all" ? locations[0]?.id : loc}
        onClose={() => setAdding(false)}
        onCreated={(member) => setMembers((current) => [{ ...member, locationId: member.locationId || locations[0]?.id || "little-rock" }, ...current])}
      />

      {/* location switcher */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <LocChip label="All locations" n={members.length} active={loc === "all"} onClick={() => setLoc("all")} />
        {locations.map((l) => (
          <LocChip key={l.id} label={l.name} sub={l.floorType} n={countAt(l.id)} active={loc === l.id} onClick={() => setLoc(l.id)} />
        ))}
      </div>

      {selectedLoc && (
        <div className="flex items-center gap-2 mb-3 text-[13px] text-muted">
          <IconMapPin size={15} className="text-primary" /> {selectedLoc.name} · <span className="font-medium text-head">{selectedLoc.floorType}</span> floor · {visible.length} member{visible.length === 1 ? "" : "s"}
        </div>
      )}

      <Panel title={`Associates (${visible.length})`}>
        <div className="overflow-x-auto"><table className="w-full border-collapse">
          <thead>
            <tr>
              {["Associate", "Role", "JewelCert type", "Location", ""].map((h) => (
                <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => (
              <tr key={m.id} className="hover:bg-rowhover">
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-[30px] h-[30px] rounded-full bg-[#eef2f7] flex items-center justify-center text-[11px] font-semibold text-[#5b6472]">{m.initials}</span>
                    <span className="font-medium text-head">{m.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">{m.role}</td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><TypeLabel primary={m.primary} type={m.type} /></td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                  <select value={m.locationId} onChange={(e) => reassign(m.id, e.target.value)} className="border border-line rounded-md bg-panel text-[12.5px] text-body px-2 py-1.5 outline-none focus:border-primary">
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                  <div className="flex items-center gap-1.5 justify-end">
                    <Link href="/send-jewelcert" title="Send JewelCert" className="w-8 h-8 rounded-md border border-line text-muted hover:bg-rowhover hover:text-primary flex items-center justify-center"><IconSend size={16} /></Link>
                    <button onClick={() => remove(m.id)} title="Remove from team" className="w-8 h-8 rounded-md border border-line text-muted hover:bg-[#fcebeb] hover:text-[#a32d2d] hover:border-[#f0c9c9] flex items-center justify-center"><IconX size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted text-[13px]">No associates at this location.</td></tr>}
          </tbody>
        </table></div>
      </Panel>

      <p className="text-[11.5px] text-muted mt-3">Tip: the visual sales-floor mix per location lives on <Link href="/team-map" className="text-primary no-underline">Team map</Link>.</p>
    </div>
  );
}

function LocChip({ label, sub, n, active, onClick }: { label: string; sub?: string; n: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-left ${active ? "bg-[#e8f1ff] border-primary text-primary" : "bg-panel border-line text-body hover:bg-rowhover"}`}>
      <span className="text-[12.5px] font-medium">{label}</span>
      {sub && <span className="text-[10.5px] text-muted">· {sub}</span>}
      <span className={`text-[11px] rounded-full px-1.5 ${active ? "bg-[#d7e6ff]" : "bg-[#eef2f7] text-muted"}`}>{n}</span>
    </button>
  );
}
