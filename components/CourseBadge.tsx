import { IconDiamond } from "@/components/icons";

// Auto-generated completion badge — no image upload needed. The badge is drawn
// from the course's label + color, with an optional earned date.
export function CourseBadge({
  label,
  color,
  earnedOn,
  size = "md",
}: {
  label: string;
  color: string;
  earnedOn?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? 88 : size === "sm" ? 40 : 60;
  const icon = size === "lg" ? 34 : size === "sm" ? 16 : 24;

  return (
    <div className="inline-flex flex-col items-center text-center">
      <div
        className="rounded-full flex items-center justify-center text-white shadow-sm ring-4 ring-white"
        style={{ width: dim, height: dim, background: `linear-gradient(135deg, ${color}, ${shade(color, 18)})` }}
      >
        <IconDiamond size={icon} />
      </div>
      {size !== "sm" && (
        <>
          <div className="mt-2 text-[12.5px] font-semibold text-head max-w-[140px] leading-tight">{label}</div>
          {earnedOn ? <div className="text-[11px] text-muted mt-0.5">Earned {earnedOn}</div> : null}
        </>
      )}
    </div>
  );
}

// Lighten a hex color by a percentage for the gradient's second stop.
function shade(hex: string, percent: number): string {
  const n = hex.replace("#", "");
  if (n.length !== 6) return hex;
  const num = parseInt(n, 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, (num >> 16) + amt);
  const g = Math.min(255, ((num >> 8) & 0xff) + amt);
  const b = Math.min(255, (num & 0xff) + amt);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Compact inline chip form for lists (e.g. "credentials earned").
export function CourseBadgeChip({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium text-white" style={{ background: color }}>
      <IconDiamond size={12} /> {label}
    </span>
  );
}
