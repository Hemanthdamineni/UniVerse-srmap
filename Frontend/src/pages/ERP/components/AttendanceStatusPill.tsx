import type { CSSProperties } from "react";

export type BunkStatus = "safe" | "caution" | "required";

const STATUS_META: Record<BunkStatus, { label: string; className: string }> = {
  safe: { label: "Safe", className: "erp-status-pill-success" },
  caution: { label: "Caution", className: "erp-status-pill-warning" },
  required: { label: "Required", className: "erp-status-pill-error" },
};

/**
 * The single source of truth for how a bunk-capacity status renders as a pill.
 * Shared by the desktop attendance table and the mobile subject cards so the two
 * layouts never drift. Colour, border and background come from the tuned
 * `.erp-status-pill-*` classes — a leading dot carries the state at a glance
 * without leaning on an emoji glyph that renders differently per platform.
 */
export function AttendanceStatusPill({
  status,
  className,
  style,
}: {
  status: BunkStatus;
  className?: string;
  style?: CSSProperties;
}) {
  const meta = STATUS_META[status] ?? STATUS_META.caution;
  return (
    <span
      className={`erp-status-pill erp-status-pill--dot ${meta.className}${
        className ? ` ${className}` : ""
      }`}
      style={style}
    >
      <span aria-hidden="true" className="erp-status-dot" />
      {meta.label}
    </span>
  );
}
