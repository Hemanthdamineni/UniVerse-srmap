import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DataToolbarProps = {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
};

export function DataToolbar({ left, right, className }: DataToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-3 md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <div className="min-w-0 flex-1">{left}</div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">{right}</div>
    </div>
  );
}
