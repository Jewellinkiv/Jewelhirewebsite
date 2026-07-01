import Link from "next/link";
import { notFound } from "next/navigation";
import { getPosting, postingKpis, JOB_POSTINGS, JobStage } from "@/lib/job-postings";
import { Panel, FitBadge } from "@/components/ui";
import { FitTier } from "@/lib/gemmatch";
import { IconClock, IconUsers, IconUserPlus, IconBriefcase, IconTargetArrow } from "@/components/icons";

export function generateStaticParams() {
  return JOB_POSTINGS.map((j) => ({ slug: j.slug }));
}

const STAGE_STYLE: Record<JobStage, string> = {
  Applied: "bg-[#eef2f7] text-[#5b6472]",
  JewelCert: "bg-[#fff4e2] text-[#9a6a12]",
  GemMatch: "bg-[#e8f1ff] text-primary",
  Interview: "bg-[#e1f5ee] text-[#0f6e56]",
  Hired: "bg-[#dff3e8] text-[#0f6e56]",
  Rejected: "bg-[#fcebeb] text-[#a32d2d]",
  Withdrawn: "bg-[#eef2f7] text-[#5b6472]",
};

function Stat({ label, value, sub, icon }: { label: string; value: string | number; sub: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-panel border border-line rounded px-4 py-[15px]">
      <div className="text-xs text-muted font-medium flex items-center gap-1.5">{icon}{label}</div>
      <div className="text-2xl font-semibold text-head mt-[5px] leading-none">{value}</div>
      <div className="text-xs mt-[5px] text-muted">{sub}</div>
    </div>
  );
}

export default async function JobDetail(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const j = getPosting(params.slug);
  if (!j) notFound();
  const k = postingKpis(j);

  return (
    <div>
      <div className="text-[12.5px] text-muted mb-3.5">
        <Link href="/jobs" className="text-primary no-underline">Jobs</Link> / {j.title}
      </div>

      {/* header */}
      <div className="flex flex-wrap items-center gap-3.5 bg-panel border border-line rounded px-[18px] py-4 mb-4">
        <span className="w-12 h-12 rounded-[10px] bg-[#e8f1ff] text-primary flex items-center justify-center"><IconBriefcase size={22} /></span>
        <div>
          <h1 className="text-[20px] font-bold text-head m-0">{j.title}</h1>
          <div className="text-[13px] text-muted mt-0.5 flex flex-wrap items-center gap-2">
            {j.location} · {j.openings} opening{j.openings === 1 ? "" : "s"}
            <span className={`text-[11.5px] font-medium px-2.5 py-1 rounded-full ${j.status === "Active" ? "bg-[#e1f5ee] text-[#0f6e56]" : j.status === "Draft" ? "bg-[#eef2f7] text-[#5b6472]" : "bg-[#fff4e2] text-[#9a6a12]"}`}>{j.status}</span>
          </div>
        </div>
        <div className="ml-auto flex gap-2.5">
          <Link href="/send-jewelcert" className="btn-outline px-3.5 py-2.5 text-[13px]">Send JewelCert</Link>
          <button className="btn-grad px-4 py-2.5 text-[13px]">Edit posting</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5 mb-[18px]">
        <Stat label="Running" value={`${j.postedDaysAgo}d`} sub="Since posted" icon={<IconClock size={13} />} />
        <Stat label="Applicants" value={k.total} sub={`${k.unique} unique`} icon={<IconUsers size={13} />} />
        <Stat label="Hired" value={k.hired} sub={`${j.openings} seat${j.openings === 1 ? "" : "s"}`} icon={<IconUserPlus size={13} />} />
        <Stat label="Views" value={j.views} sub="Public page" />
        <Stat label="Apply rate" value={`${k.applyRate}%`} sub="Views → applies" />
        <Stat label="Avg fit" value={k.avgFit != null ? k.avgFit : "—"} sub="GemMatch" icon={<IconTargetArrow size={13} />} />
      </div>

      {/* applicant history */}
      <Panel title={`Applicants over time (${k.total})`} action={<span className="text-[11.5px] text-muted">duplicates = re-applies</span>}>
        <div className="overflow-x-auto"><table className="w-full border-collapse">
          <thead>
            <tr>
              {["Applicant", "Applied", "Attempt", "Status", "Fit"].map((h) => (
                <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {j.applicants.map((a, i) => (
              <tr key={`${a.id}-${i}`} className="hover:bg-rowhover">
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                  <Link href={`/applicants/${a.id}`} className="flex items-center gap-2.5 no-underline">
                    <span className="w-[30px] h-[30px] rounded-full bg-[#e8f1ff] flex items-center justify-center text-[11px] font-bold text-primary">{a.initials}</span>
                    <span className="font-medium text-head">{a.name}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] text-body">{a.appliedDate}</td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                  {a.attempt > 1 ? <span className="text-[11.5px] font-medium px-2 py-0.5 rounded-full bg-[#efe9fd] text-[#5a44c9]">Re-apply #{a.attempt}</span> : <span className="text-muted text-[12px]">1st</span>}
                </td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><span className={`inline-flex text-[11.5px] font-medium px-2.5 py-1 rounded-full ${STAGE_STYLE[a.stage]}`}>{a.stage}</span></td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                  {a.fitScore != null && a.fitTier ? <FitBadge score={a.fitScore} tier={a.fitTier as FitTier} /> : <span className="text-muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Panel>
    </div>
  );
}
