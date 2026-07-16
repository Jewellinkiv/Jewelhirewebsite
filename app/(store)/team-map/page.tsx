import Link from "next/link";
import { PageHeader } from "@/components/common";
import { Panel, Radar, MixBars, TypeLabel } from "@/components/ui";
import { IconUserPlus, IconSend } from "@/components/icons";
import { getSessionContext } from "@/lib/server/access-control";
import { getTeamStore } from "@/lib/server/stores/team-store";
import { Mix, PROFILES, PROFILE_ORDER, ProfileCode } from "@/lib/gemmatch";

// Server Component: the team's mix, floor type, and gaps are fetched on the
// server and rendered into the HTML. Earlier this was a client page that fetched
// in useEffect; on a hard load the effect never fired (the page hydrated as a
// streamed Suspense child and its effect was dropped), leaving a permanent
// "Loading…". Rendering server-side removes that dependency entirely — the data
// is in the first paint. The page is display-only, so no client code is needed.

const STATUS_STYLE: Record<string, string> = {
  Active: "bg-[#e1f5ee] text-[#0f6e56]",
  "On leave": "bg-[#fdf0e2] text-[#9a5a12]",
  New: "bg-[#e8f1ff] text-primary",
};

// Suggested hire for a trait the floor is short on.
const HIRE_FOR: Record<ProfileCode, string> = {
  V: "a Visionary (Architect / Innovator) to add strategy and fresh ideas",
  C: "a Connector (Luxury Advisor) for warmth and clienteling",
  F: "a Foundation (Operational Anchor) to steady process and precision",
  D: "a Determined closer (Sales Strategist) for drive and closing power",
};

const EVEN_SHARE = 100 / PROFILE_ORDER.length; // 25% if each trait were equal

export default async function TeamMapPage() {
  const session = await getSessionContext().catch(() => null);
  const storeId = session?.activeStoreId || session?.storeIds?.[0] || "store-sissys-little-rock";

  const teamStore = getTeamStore();
  const [members, composition] = await Promise.all([
    Promise.resolve(teamStore.listStoreTeamMembers({ storeId })),
    Promise.resolve(teamStore.getTeamComposition({ storeId })),
  ]);

  const mix: Mix = composition.mix;
  const assessed = composition.tested;
  const ranked = [...PROFILE_ORDER].sort((a, b) => mix[b] - mix[a]);
  const rich = ranked.filter((p) => mix[p] > EVEN_SHARE);
  const short = [...ranked].reverse().filter((p) => mix[p] < EVEN_SHARE * 0.6);
  const floorType = composition.floorType;

  return (
    <div className="max-w-[940px]">
      <PageHeader title="Team map" subtitle="The whole team's mix, floor type, and where you're rich vs. short." />

      <div className="flex flex-col gap-[18px]">
        {/* 1 · Team mix */}
        <Panel title={assessed ? `Team mix · ${floorType} floor` : "Team mix"}>
          {assessed ? (
            <div className="p-4 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5 items-center">
              <div className="max-w-[260px] mx-auto w-full"><Radar mix={mix} size={240} /></div>
              <MixBars mix={mix} />
            </div>
          ) : (
            <div className="p-6 text-[13px] text-muted">
              {members.length
                ? `${members.length} team member${members.length === 1 ? " is" : "s are"} waiting on a completed JewelCert result.`
                : "No team members yet. Hired applicants show up here with their JewelCert mix."}
            </div>
          )}
        </Panel>

        {/* 2 · Strengths & gaps — derived from the real mix */}
        {assessed ? (
          <Panel title="Strengths & gaps">
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="border border-[#cdeadd] bg-[#e9f6f0] rounded-md px-3.5 py-3">
                <h5 className="m-0 mb-1.5 text-[13px] font-semibold text-[#0f6e56]">Rich in</h5>
                <p className="m-0 text-[13px] text-body">
                  {rich.length
                    ? rich.map((p) => `${PROFILES[p].name} (${PROFILES[p].lane.toLowerCase()})`).join(", ")
                    : "A balanced spread — no single trait dominates the floor."}
                </p>
              </div>
              <div className="border border-[#f3d9cd] bg-[#fdf1ec] rounded-md px-3.5 py-3">
                <h5 className="m-0 mb-1.5 text-[13px] font-semibold text-[#993c1d]">Short on</h5>
                <p className="m-0 text-[13px] text-body">
                  {short.length
                    ? short.map((p) => `${PROFILES[p].name} (${PROFILES[p].lane.toLowerCase()})`).join(", ")
                    : "Nothing glaring — every trait has some coverage."}
                </p>
              </div>
              <div className="border border-[#cfe0fb] bg-[#eef4ff] rounded-md px-3.5 py-3">
                <h5 className="m-0 mb-2 text-[13px] font-semibold text-primary flex items-center gap-1.5"><IconUserPlus size={15} /> Hire next</h5>
                {short.length ? (
                  <ul className="m-0 pl-4 text-[13px] text-body leading-relaxed">
                    {short.map((p) => <li key={p}>{HIRE_FOR[p]}</li>)}
                    {rich.length ? <li>Go easy on adding more {PROFILES[ranked[0]].name.toLowerCase()}</li> : null}
                  </ul>
                ) : (
                  <p className="m-0 text-[13px] text-body">Your floor is well-rounded — hire for role need over trait gaps.</p>
                )}
              </div>
            </div>
          </Panel>
        ) : null}

        {/* 3 · Associates — real members */}
        <Panel
          title={`Associates (${members.length})`}
          action={<Link href="/team" className="text-[12.5px] text-primary no-underline">Manage team</Link>}
        >
          {members.length ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[560px]">
                <thead>
                  <tr>
                    {["Associate", "Role", "JewelCert type", "Status"].map((h) => (
                      <th key={h} className="text-left border-b border-line px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted whitespace-nowrap">{h}</th>
                    ))}
                    <th className="border-b border-line px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-rowhover">
                      <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white" style={{ background: m.assessed !== false ? PROFILES[m.primary].color : "#b4bdcb" }}>{m.initials}</span>
                          <span className="font-medium text-head whitespace-nowrap">{m.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] whitespace-nowrap">{m.role}</td>
                      <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] whitespace-nowrap">
                        {m.assessed !== false ? <TypeLabel primary={m.primary} type={m.type} /> : <span className="text-muted">Not assessed</span>}
                      </td>
                      <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                        <span className={`text-[11px] font-medium px-2 py-1 rounded-full whitespace-nowrap ${STATUS_STYLE[m.status ?? ""] || "bg-[#eef1f6] text-muted"}`}>{m.status ?? "Active"}</span>
                      </td>
                      <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                        <Link href="/send-jewelcert" title="Send JewelCert" className="w-8 h-8 rounded-md border border-line text-muted hover:bg-rowhover hover:text-primary flex items-center justify-center"><IconSend size={16} /></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-[13px] text-muted">No team members yet. Hired applicants show up here.</div>
          )}
        </Panel>
      </div>
    </div>
  );
}
