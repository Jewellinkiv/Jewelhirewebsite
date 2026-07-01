import { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-[18px]">
      <div>
        <h1 className="text-[21px] font-semibold text-head m-0">{title}</h1>
        {subtitle && <p className="mt-[3px] mb-0 text-muted text-[13px]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Placeholder({ title, note, subtitle }: { title: string; note?: string; subtitle?: string }) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle ?? note} />
      <div className="bg-panel border border-line rounded p-10 text-center text-muted text-sm">
        This module is part of the JewelHire v2 plan — design coming next.
      </div>
    </div>
  );
}
