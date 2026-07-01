import { ReactNode } from "react";
import { IconBulb, IconRefresh, IconSearch } from "@/components/icons";

// Shared empty / loading / error building blocks (I4). Presentational only —
// safe in both server and client components. No product-model changes.

export function EmptyState({
  icon,
  title,
  message,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`text-center ${compact ? "py-8" : "py-12"} px-4`}>
      <div className="w-11 h-11 rounded-full bg-[#eef2f7] text-muted flex items-center justify-center mx-auto mb-3">
        {icon ?? <IconBulb size={20} />}
      </div>
      <div className="text-[14px] font-semibold text-head">{title}</div>
      {message && <p className="text-[12.5px] text-muted mt-1 mb-0 max-w-[340px] mx-auto leading-relaxed">{message}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function NoResults({ label = "results" }: { label?: string }) {
  return <EmptyState compact icon={<IconSearch size={20} />} title={`No ${label} match`} message="Try a different search or clear your filters." />;
}

// Skeleton primitives (use a subtle shimmer via animate-pulse).
export function SkeletonLine({ w = "100%", h = 12 }: { w?: string; h?: number }) {
  return <span className="block rounded bg-[#e9edf3] animate-pulse" style={{ width: w, height: h }} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-panel border border-line rounded-lg p-4">
      <SkeletonLine w="40%" h={14} />
      <div className="mt-3 flex flex-col gap-2">
        <SkeletonLine w="90%" />
        <SkeletonLine w="75%" />
        <SkeletonLine w="60%" />
      </div>
    </div>
  );
}

export function SkeletonStats({ n = 4 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-[18px]">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="bg-panel border border-line rounded px-4 py-[15px]">
          <SkeletonLine w="50%" />
          <div className="mt-2"><SkeletonLine w="35%" h={20} /></div>
        </div>
      ))}
    </div>
  );
}

export function PageLoading({ title = "Loading…" }: { title?: string }) {
  return (
    <div aria-busy="true" aria-label={title}>
      <SkeletonLine w="180px" h={20} />
      <div className="h-4" />
      <SkeletonStats />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

export function ErrorState({ reset, title = "Something went wrong", message }: { reset?: () => void; title?: string; message?: string }) {
  return (
    <EmptyState
      icon={<IconRefresh size={20} />}
      title={title}
      message={message ?? "This view hit a snag. You can try again — your data is safe."}
      action={
        reset ? (
          <button onClick={reset} className="btn-grad inline-flex items-center gap-1.5 px-4 py-2 text-[13px]">
            <IconRefresh size={15} /> Try again
          </button>
        ) : undefined
      }
    />
  );
}
