import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  className?: string;
  currentPage: string | number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ className, currentPage, totalPages, onPageChange }: PaginationProps) {
  const current = Number(currentPage) || 1;
  const disablePrev = current <= 1;
  const disableNext = current >= totalPages;

  return (
    <div className={cn("flex items-center justify-between gap-4 py-3", className)}>
      <span className="text-sm text-[var(--comp-text-secondary)]">
        Page <span className="font-semibold text-[var(--comp-text-primary)]">{current}</span> of{" "}
        <span className="font-semibold text-[var(--comp-text-primary)]">{totalPages || 1}</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          disabled={disablePrev}
          onClick={() => onPageChange(current - 1)}
          className="btn-ghost px-2 disabled:opacity-50"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          disabled={disableNext}
          onClick={() => onPageChange(current + 1)}
          className="btn-ghost px-2 disabled:opacity-50"
          aria-label="Next page"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
