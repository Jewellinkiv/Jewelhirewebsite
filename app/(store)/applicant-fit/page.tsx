import { PageHeader } from "@/components/common";
import { Panel, Radar } from "@/components/ui";
import { getCandidate, TEAM_MIX } from "@/lib/data";
import { PROFILES } from "@/lib/gemmatch";
import { IconTargetArrow, IconBulb } from "@/components/icons";

export default function ApplicantFitPage() {
  const c = getCandidate("maya-chen")!;
  const gm = c.gemmatch!;
  const fit = c.fit!;

  return (
    <div>
      <PageHeader title="Applicant fit" subtitle="One applicant scored against this team and the open role." />
      <Panel className="overflow-hidden">
        <div className="flex items-center gap-3.5 px-5 py-4 border-b border-line">
          <div className="w-[46px] h-[46px] rounded-[10px] flex items-center justify-center text-white" style={{ background: PROFILES[gm.primary].color }}>{c.initials}</div>
          <div>
            <h3 className="m-0 text-[17px] font-semibold text-head">{c.name} — {gm.type}</h3>
            <p className="m-0 mt-0.5 text-[12.5px] text-muted">{PROFILES[gm.primary].name} → {PROFILES[gm.secondary].name} · applying {c.role}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 px-5 py-4 bg-[#f1f7fd] border-b border-line">
          <div className="flex flex-col items-center justify-center w-28 h-[84px] rounded-[12px] border-2 border-primary bg-white">
            <span className="text-[14px] font-semibold text-primary">{fit.tier}</span>
            <span className="text-[26px] font-semibold text-primary leading-none">{fit.fitScore}<span className="text-[11px] text-muted font-normal">/100</span></span>
          </div>
          <div className="text-[14px] text-body leading-relaxed flex-1 min-w-[240px]">{fit.reasons.join(". ")}.</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="p-5 lg:border-r border-line">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted m-0 mb-3">How the score is built</p>
            <div className="flex items-center gap-2.5 mb-1"><span className="w-[70px] text-[13px]">Role fit</span><span className="flex-1 h-2.5 bg-[#eef1f7] rounded-md overflow-hidden"><span className="block h-full bg-prof-v" style={{ width: `${fit.roleFit}%` }} /></span><span className="w-7 text-right text-[13px] text-muted">{fit.roleFit}</span></div>
            <p className="text-xs text-muted m-0 mb-3 pl-[80px]">Match to the open role&apos;s ideal profile</p>
            <div className="flex items-center gap-2.5 mb-1"><span className="w-[70px] text-[13px]">Team fit</span><span className="flex-1 h-2.5 bg-[#eef1f7] rounded-md overflow-hidden"><span className="block h-full bg-prof-f" style={{ width: `${fit.teamFit}%` }} /></span><span className="w-7 text-right text-[13px] text-muted">{fit.teamFit}</span></div>
            <p className="text-xs text-muted m-0 mb-4 pl-[80px]">Fills the team&apos;s gaps without amplifying excess</p>
            <div className="text-[13px] text-body bg-page border border-line rounded-md px-3 py-2.5">Blend = 0.55 × {fit.roleFit} + 0.45 × {fit.teamFit} = <b>{fit.fitScore} · {fit.tier}</b></div>
          </div>
          <div className="p-5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted m-0 mb-2">Applicant vs. team</p>
            <div className="max-w-[260px] mx-auto"><Radar mix={gm.mix} overlay={TEAM_MIX} size={240} /></div>
            <div className="flex gap-4 justify-center text-xs text-muted mt-1.5">
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: PROFILES[gm.primary].color }} />{c.name.split(" ")[0]}</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-prof-d" />Team</span>
            </div>
            <div className="border border-[#cfe0fb] bg-[#eef4ff] rounded-md px-3.5 py-3 mt-4">
              <h5 className="m-0 mb-1.5 text-[13px] font-semibold text-primary flex items-center gap-1.5"><IconBulb size={15} /> Hint</h5>
              <p className="m-0 text-[13px] text-body">Even stronger fit for a <b>Bridal / Clienteling Specialist</b> role.</p>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
