import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ASSESSMENT_RESULTS,
  getAssessmentResult,
  CategoryScore,
  TraitScore,
} from "@/lib/assessment-results";
import { Panel } from "@/components/ui";
import {
  IconCheck,
  IconX,
  IconClipboardList,
  IconSchool,
  IconChevronRight,
  IconTargetArrow,
  IconBulb,
} from "@/components/icons";

export function generateStaticParams() {
  return Object.values(ASSESSMENT_RESULTS).map((r) => ({
    slug: r.slug,
    candidate: r.candidate.id,
  }));
}

function barColor(pct: number) {
  return pct >= 75 ? "#1f9e75" : pct >= 50 ? "#c08a16" : "#c0492f";
}

function CategoryRow({ c }: { c: CategoryScore }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#eef1f6] last:border-0">
      <span className="w-[150px] text-[13px] text-head">{c.target}</span>
      <span className="flex-1 h-2.5 bg-[#eef1f7] rounded-full overflow-hidden">
        <span className="block h-full rounded-full" style={{ width: `${c.pct}%`, background: barColor(c.pct) }} />
      </span>
      <span className="w-12 text-right text-[12.5px] text-muted">{c.score}/{c.max}</span>
      <span className="w-10 text-right text-[12.5px] font-semibold" style={{ color: barColor(c.pct) }}>{c.pct}%</span>
    </div>
  );
}

const LEVEL_STYLE: Record<TraitScore["level"], string> = {
  Strong: "bg-[#e1f5ee] text-[#0f6e56]",
  Solid: "bg-[#e8f1ff] text-[#123FB9]",
  Developing: "bg-[#fff4e2] text-[#9a6a12]",
  Low: "bg-[#fcebeb] text-[#a32d2d]",
};

function TraitRow({ t }: { t: TraitScore }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#eef1f6] last:border-0">
      <span className="w-[170px] text-[13px] text-head">{t.trait}</span>
      <span className="flex-1 h-2.5 bg-[#eef1f7] rounded-full overflow-hidden">
        <span className="block h-full rounded-full" style={{ width: `${t.pct}%`, background: barColor(t.pct) }} />
      </span>
      <span className="w-10 text-right text-[12.5px] text-muted">{t.pct}%</span>
      <span className={`w-[86px] text-center text-[11px] font-semibold px-2 py-1 rounded-full ${LEVEL_STYLE[t.level]}`}>{t.level}</span>
    </div>
  );
}

export default async function AssessmentReview(props: { params: Promise<{ slug: string; candidate: string }> }) {
  const params = await props.params;
  const r = getAssessmentResult(params.slug);
  if (!r) notFound();
  const isKnowledge = r.type === "knowledge_check";

  return (
    <div>
      <div className="text-[12.5px] text-muted mb-3.5">
        <Link href="/assessments" className="text-primary no-underline">Assessments</Link> ›{" "}
        {r.title} › {r.candidate.name}
      </div>

      {/* header */}
      <div className="flex flex-wrap items-center gap-3.5 bg-panel border border-line rounded px-[18px] py-4 mb-4">
        <div className="w-[50px] h-[50px] rounded-full bg-[#e8f1ff] text-primary flex items-center justify-center font-bold text-[18px]">{r.candidate.initials}</div>
        <div>
          <h1 className="text-[20px] font-bold text-head m-0">{r.candidate.name}</h1>
          <div className="text-[13px] text-muted mt-[3px] flex items-center gap-2 flex-wrap">
            {r.title} · {r.candidate.role}
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1 rounded-full bg-[#fff4e2] text-[#9a6a12]">{r.status}</span>
          </div>
        </div>
        <div className="ml-auto flex gap-2.5">
          <button className="btn-outline inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px]"><IconSchool size={16} /> Assign training</button>
          <button className="btn-grad inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px]"><IconCheck size={16} /> Mark reviewed</button>
        </div>
      </div>

      {/* score band */}
      <div className="flex flex-wrap items-center gap-5 bg-[#eef4ff] border border-[#cfe0fb] rounded px-5 py-4 mb-4">
        <div className="flex flex-col items-center justify-center min-w-[110px]">
          {isKnowledge ? (
            <>
              <span className="text-[30px] font-extrabold text-primary leading-none">{r.totalScore}<span className="text-[13px] text-muted font-normal">/100</span></span>
              <span className="text-[12px] text-muted mt-1">{r.scoreLabel}</span>
            </>
          ) : (
            <>
              <span className="text-[17px] font-bold text-primary leading-tight text-center">{r.scoreLabel}</span>
              <span className="text-[12px] text-muted mt-1">Dominant trait</span>
            </>
          )}
        </div>
        <div className="text-[14px] text-body leading-relaxed flex-1 min-w-[260px]">{r.summary}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4">
        {/* main */}
        <div>
          <Panel
            title={isKnowledge ? "Score by category" : "Trait profile"}
            icon={<IconTargetArrow size={16} />}
            className="mb-4"
          >
            <div>
              {isKnowledge
                ? r.categories!.map((c) => <CategoryRow key={c.target} c={c} />)
                : r.traits!.map((t) => <TraitRow key={t.trait} t={t} />)}
            </div>
          </Panel>

          <Panel title="Answer review" icon={<IconClipboardList size={16} />}>
            <div className="divide-y divide-[#eef1f6]">
              {r.answerReview.map((a) => (
                <div key={a.n} className="p-4">
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      a.correct === false ? "bg-[#fcebeb] text-[#a32d2d]" : a.correct === true ? "bg-[#e1f5ee] text-[#0f6e56]" : "bg-[#e8f1ff] text-primary"
                    }`}>
                      {a.correct === false ? <IconX size={12} /> : a.correct === true ? <IconCheck size={12} /> : <span className="text-[10px] font-bold">{a.target.charAt(0)}</span>}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-head">{a.prompt}</div>
                      <div className="text-[11.5px] text-muted mt-0.5">{a.target}</div>
                      <div className="mt-2 text-[12.5px]">
                        <span className="text-muted">Answered: </span>
                        <span className={a.correct === false ? "text-[#a32d2d]" : "text-body"}>{a.selected.text}</span>
                        <span className="text-muted"> ({a.selected.points} pt{a.selected.points === 1 ? "" : "s"})</span>
                      </div>
                      {a.preferred && a.correct === false && (
                        <div className="mt-1 text-[12.5px] text-[#0f6e56]">
                          Best answer: {a.preferred.text} ({a.preferred.points} pts)
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* side rail */}
        <div>
          <Panel title="Manager recommendation" icon={<IconBulb size={16} />} className="mb-4">
            <div className="p-4">
              <span className="inline-flex text-[12px] font-bold text-primary bg-[#e8f1ff] px-3 py-1.5 rounded-full">{r.recommendation.decision}</span>
              <p className="text-[13px] text-body leading-relaxed mt-3 mb-4">{r.recommendation.text}</p>
              <div className="flex flex-col gap-2">
                <button className="btn-grad px-4 py-2.5 text-[13px] inline-flex items-center justify-center gap-1.5"><IconCheck size={15} /> Advance candidate</button>
                <button className="btn-outline px-4 py-2.5 text-[13px] inline-flex items-center justify-center gap-1.5">Hold for coaching</button>
              </div>
            </div>
          </Panel>

          <Panel title="Follow-up training" icon={<IconSchool size={16} />} className="mb-4">
            <div className="divide-y divide-[#eef1f6]">
              {r.followUps.map((f) => (
                <Link key={f.course} href={f.href} className="flex items-start gap-2.5 p-4 no-underline hover:bg-rowhover">
                  <span className="w-8 h-8 rounded-md bg-[#e8f1ff] text-primary flex items-center justify-center flex-shrink-0"><IconSchool size={17} /></span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-head">{f.course}</div>
                    <div className="text-[12px] text-muted mt-0.5">{f.reason}</div>
                  </div>
                  <IconChevronRight size={16} className="ml-auto text-muted mt-1" />
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Completion">
            <div className="p-4 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-2 text-[13px]">
              <span className="text-muted">Completed</span><span>{r.completedAt}</span>
              <span className="text-muted">Time taken</span><span>{r.durationMinutes} min</span>
              <span className="text-muted">Status</span><span>{r.status}</span>
              <span className="text-muted">Type</span><span>{isKnowledge ? "Knowledge check" : "Trait profile"}</span>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
