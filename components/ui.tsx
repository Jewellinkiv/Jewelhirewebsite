import { ReactNode } from "react";
import { Mix, PROFILES, PROFILE_ORDER, ProfileCode, FitTier as Tier } from "@/lib/gemmatch";
import { CandidateStatus } from "@/lib/data";

/* ---------- Panel ---------- */
export function Panel({
  title,
  icon,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-panel border border-line rounded ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line">
          <h3 className="m-0 text-sm font-semibold text-head flex items-center gap-2">
            {icon}
            {title}
          </h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/* ---------- Status chip ---------- */
const STATUS_STYLE: Record<CandidateStatus, string> = {
  New: "bg-[#eef2f7] text-[#5b6472]",
  "Cert sent": "bg-[#fff4e2] text-[#9a6a12]",
  Assessed: "bg-[#e8f1ff] text-primary",
  "In review": "bg-[#efe9fd] text-[#5a44c9]",
  Interview: "bg-[#e1f5ee] text-[#0f6e56]",
  Hired: "bg-[#e1f5ee] text-[#0f6e56]",
  Rejected: "bg-[#fcebeb] text-[#a32d2d]",
};

export function StatusChip({ status }: { status: CandidateStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[status]}`}
    >
      {status}
    </span>
  );
}

/* ---------- Fit tier badge ---------- */
const TIER_STYLE: Record<Tier, string> = {
  "Strong fit": "bg-[#e1f5ee] text-[#0f6e56]",
  "Good fit": "bg-[#e8f1ff] text-primary",
  Stretch: "bg-[#fdf0e2] text-[#9a5a12]",
  "Poor fit": "bg-[#fcebeb] text-[#a32d2d]",
};

export function FitBadge({ score, tier }: { score: number; tier: Tier }) {
  return (
    <span className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-md ${TIER_STYLE[tier]}`}>
      {score} · {tier.replace(" fit", "")}
    </span>
  );
}

/* ---------- Type label with dot ---------- */
export function TypeLabel({ primary, type }: { primary: ProfileCode; type: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-body">
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: PROFILES[primary].color }}
      />
      {type}
    </span>
  );
}

/* ---------- Mix bars ---------- */
export function MixBars({ mix }: { mix: Mix }) {
  const order: ProfileCode[] = ["V", "D", "C", "F"];
  return (
    <div>
      {order.map((k) => (
        <div key={k} className="flex items-center gap-2.5 mb-2">
          <span className="w-20 text-[12.5px]">{PROFILES[k].name}</span>
          <span className="flex-1 h-2 bg-[#eef1f7] rounded-[5px] overflow-hidden">
            <span
              className="block h-full"
              style={{ width: `${mix[k]}%`, background: PROFILES[k].color }}
            />
          </span>
          <span className="w-8 text-right text-xs text-muted">{mix[k]}%</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Radar (4-axis: V top, C right, F bottom, D left) ---------- */
export function Radar({
  mix,
  overlay,
  size = 220,
}: {
  mix: Mix;
  overlay?: Mix;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2 - 2;
  const R = size * 0.36;
  const axes: { k: ProfileCode; dx: number; dy: number }[] = [
    { k: "V", dx: 0, dy: -1 },
    { k: "C", dx: 1, dy: 0 },
    { k: "F", dx: 0, dy: 1 },
    { k: "D", dx: -1, dy: 0 },
  ];
  const poly = (m: Mix) =>
    axes
      .map((a) => {
        const r = R * (m[a.k] / 100);
        return `${cx + a.dx * r},${cy + a.dy * r}`;
      })
      .join(" ");

  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`}>
      {[0.34, 0.67, 1].map((ring, i) => (
        <polygon
          key={i}
          points={axes.map((a) => `${cx + a.dx * R * ring},${cy + a.dy * R * ring}`).join(" ")}
          fill="none"
          stroke="#eef1f7"
        />
      ))}
      {axes.map((a) => (
        <g key={a.k}>
          <line x1={cx} y1={cy} x2={cx + a.dx * R} y2={cy + a.dy * R} stroke="#e6e8ee" />
          <text
            x={cx + a.dx * (R + 16)}
            y={cy + a.dy * (R + 16) + 4}
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill={PROFILES[a.k].color}
          >
            {a.k}
          </text>
        </g>
      ))}
      {overlay && <polygon points={poly(overlay)} fill="rgba(226,104,60,.10)" stroke="#e2683c" strokeWidth="2" />}
      <polygon points={poly(mix)} fill="rgba(70,129,244,.16)" stroke="#4681F4" strokeWidth="2" />
      {!overlay &&
        axes.map((a) => {
          const r = R * (mix[a.k] / 100);
          return <circle key={a.k} cx={cx + a.dx * r} cy={cy + a.dy * r} r="3.5" fill={PROFILES[a.k].color} />;
        })}
    </svg>
  );
}
