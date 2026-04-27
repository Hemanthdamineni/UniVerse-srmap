import { cn } from "@/lib/utils";

export interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div className={cn("p-4 md:p-6 rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] h-full w-full", className)}>
      <div className="h-6 w-1/3 skeleton-shimmer rounded mb-4"></div>
      <div className="h-4 w-full skeleton-shimmer rounded mb-2"></div>
      <div className="h-4 w-5/6 skeleton-shimmer rounded mb-2"></div>
      <div className="h-4 w-4/6 skeleton-shimmer rounded"></div>
    </div>
  );
}
