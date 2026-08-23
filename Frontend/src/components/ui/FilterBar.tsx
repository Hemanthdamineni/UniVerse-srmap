// FilterBar: search + desktop filter row; mobile uses Dialog (sheet-style) for filters per design spec.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Search, SlidersHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/dialog";

export interface FilterBarProps {
  className?: string;
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (val: string) => void;
  filters?: ReactNode;
  sortSlot?: ReactNode;
  actions?: ReactNode;
}

export function FilterBar({
  className,
  searchPlaceholder = "Search...",
  searchValue,
  onSearchChange,
  filters,
  sortSlot,
  actions,
}: FilterBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState(searchValue);
  const debounceRef = useRef<number | null>(null);

  // Keep the echoed query in sync when the owner resets it externally.
  useEffect(() => {
    setLocalQuery(searchValue);
  }, [searchValue]);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearchChange = (val: string) => {
    setLocalQuery(val);
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => onSearchChange(val), 300);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-3",
        className
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--comp-text-muted)]" />
          <input
            type="search"
            value={localQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="min-h-11 w-full rounded-lg border border-[var(--comp-border)] bg-transparent py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--comp-accent)] md:min-h-9"
          />
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
          {filters ? (
            <>
              <div className="hidden flex-wrap items-center gap-2 md:flex">
                {filters}
                {sortSlot}
              </div>
              <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="btn-secondary min-h-11 gap-2 md:hidden"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                  </button>
                </DialogTrigger>
                <DialogContent className="left-0 top-0 max-h-[min(90vh,520px)] w-full max-w-none translate-x-0 translate-y-0 rounded-b-2xl rounded-t-none border-x-0 border-t-0 sm:left-1/2 sm:top-[10vh] sm:max-h-none sm:max-w-[min(760px,calc(100vw-1.5rem))] sm:-translate-x-1/2 sm:rounded-2xl sm:border">
                  <DialogHeader>
                    <DialogTitle className="section-title">Filters & sort</DialogTitle>
                  </DialogHeader>
                  <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-6 pb-6">
                    <div className="flex flex-col gap-3">{filters}</div>
                    {sortSlot ? <div className="border-t border-[var(--comp-border)] pt-4">{sortSlot}</div> : null}
                    <button type="button" className="btn-primary mt-2 w-full" onClick={() => setMobileOpen(false)}>
                      Apply
                    </button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            sortSlot && <div className="flex w-full justify-end md:w-auto">{sortSlot}</div>
          )}
          {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
