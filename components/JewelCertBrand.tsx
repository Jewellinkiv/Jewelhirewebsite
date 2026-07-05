import { IconDiamond } from "@/components/icons";

// "JewelCert by JewelHire" brand lockup. The gradient diamond mark and the
// Jewel*** wordmark mirror the JewelHire header (see AssociateShell), but this
// leads with "JewelCert" — the assessment product applicants actually take —
// with a quiet "by JewelHire" endorsement line underneath.
export function JewelCertBrand({ size = "md", className = "" }: { size?: "md" | "lg"; className?: string }) {
  const mark = size === "lg" ? "w-11 h-11 rounded-[11px]" : "w-8 h-8 rounded-[8px]";
  const markIcon = size === "lg" ? 24 : 18;
  const title = size === "lg" ? "text-[20px]" : "text-[15.5px]";
  const sub = size === "lg" ? "text-[12px]" : "text-[10.5px]";

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className={`${mark} bg-brand-grad text-white flex items-center justify-center shrink-0`}>
        <IconDiamond size={markIcon} />
      </span>
      <span className="leading-tight">
        <span className={`block ${title} text-head font-medium`}>Jewel<span className="font-extrabold">Cert</span></span>
        <span className={`block ${sub} text-muted -mt-[1px]`}>by JewelHire</span>
      </span>
    </span>
  );
}
