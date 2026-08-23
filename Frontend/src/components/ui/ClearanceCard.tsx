import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ClearanceCardProps {
  title: string;
  description: string;
  /** Optional note cards rendered under a "Notes" divider. */
  notes?: string[];
  /** Custom icon node; defaults to the check-circle clearance glyph. */
  icon?: ReactNode;
  iconColor?: string;
  iconBgColor?: string;
  /** Wrapper classes — pass card chrome here (e.g. "dashboard-card space-y-4 p-5"). */
  className?: string;
}

const DEFAULT_ICON_COLOR = "var(--comp-accent)";
const DEFAULT_ICON_BG = "color-mix(in srgb, var(--comp-accent) 12%, transparent)";

/**
 * Centered clearance/empty-state card: circular badge, headline, description,
 * and an optional notes grid. Shared by the finance-clearance and
 * feedback-status surfaces.
 */
export function ClearanceCard({
  title,
  description,
  notes = [],
  icon,
  iconColor = DEFAULT_ICON_COLOR,
  iconBgColor = DEFAULT_ICON_BG,
  className,
}: ClearanceCardProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {/* Clearance badge + headline */}
      <div className="flex flex-col items-center py-3">
        <div
          className="mb-3 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: iconBgColor }}
        >
          {icon || (
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke={iconColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          )}
        </div>

        <h2 className="mb-1 text-xl font-bold tracking-tight" style={{ color: "var(--comp-text-primary)" }}>
          {title}
        </h2>
        <p className="mx-auto max-w-sm text-center text-sm leading-6" style={{ color: "var(--comp-text-secondary)" }}>
          {description}
        </p>
      </div>

      {/* Notes */}
      {notes.length > 0 ? (
        <div className="space-y-3">
          <div
            className="flex items-center gap-3 before:h-px before:flex-1 after:h-px after:flex-1"
            style={{ color: "color-mix(in srgb, var(--comp-text-muted) 40%, transparent)" }}
          >
            <span className="text-xs font-semibold uppercase tracking-[0.2em]">Notes</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {notes.map((note, index) => (
              <div
                key={`${index}-${note.slice(0, 32)}`}
                className="rounded-xl border px-4 py-3 text-sm leading-6"
                style={{
                  borderColor: "color-mix(in srgb, var(--comp-border) 50%, transparent)",
                  background: "color-mix(in srgb, var(--surface) 60%, transparent)",
                }}
              >
                {note}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
