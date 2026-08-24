// ErpPageShell: optional section-card layout for ERP data pages; loading uses SkeletonBlock instead of spinners.
import { useRef, type ReactNode } from "react";
import { usePageContrast } from "../../hooks/usePageContrast";
import { sanitizeErpDisplayText } from "../../lib/erp/displayText";
import { PageContainer } from "../layout/PageLayouts";
import { PageSkeleton, type PageSkeletonVariant } from "../ui/Skeletons";
import { EmptyState } from "../ui/Feedback";

export function sanitizeVisibleText(value: unknown, fallback = "") {
  return sanitizeErpDisplayText(value, fallback);
}

export type PageSourceLabel =
  | "Live ERP"
  | "Dump Snapshot"
  | "External SQLite"
  | "Internal API"
  | "Placeholder";

export type StatusTone = "success" | "warning" | "info" | "error" | "locked";

export interface KpiItem {
  label: string;
  value: string;
  trend?: number; // 1 for positive, -1 for negative
  trendLabel?: string;
  subtitle?: string;
}

export interface DataTableModel {
  title?: string;
  columns: string[];
  rows: Array<Record<string, string>>;
  disableInternalScroll?: boolean;
}

export interface SectionModel {
  title: string;
  summary?: string;
  links?: Array<{ label: string; href: string }>;
  tables: DataTableModel[];
}

export interface StatusMessage {
  id: string;
  tone: StatusTone;
  text: string;
}

interface ErpPageShellProps {
  title: string;
  source: PageSourceLabel;
  updatedAt?: string;
  isLoading?: boolean;
  loadingMessage?: string;
  loadingVariant?: PageSkeletonVariant;
  onRefresh?: () => void;
  headerActions?: ReactNode;
  surface?: "card" | "flat";
  children: ReactNode;
}

function RefreshButton({ onRefresh }: { onRefresh: () => void }) {
  return (
    <button
      type="button"
      data-page-contrast="true"
      onClick={onRefresh}
      className="page-contrast-outline flex min-h-11 min-w-11 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition hover:bg-[color-mix(in_srgb,var(--surface)_20%,transparent)] md:min-h-9 md:min-w-0"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
      </svg>
      Refresh
    </button>
  );
}

export function ErpPageShell({
  title,
  source,
  updatedAt,
  isLoading = false,
  loadingMessage = "Loading...",
  loadingVariant = "table",
  onRefresh,
  headerActions,
  // Flat by default: SectionCard children already carry dashboard-card
  // chrome; an extra card surface here would nest borders.
  surface = "flat",
  children,
}: ErpPageShellProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  usePageContrast(shellRef, [title, source, updatedAt, isLoading]);

  const headerActionsSlot = (
    <>
      {headerActions}
      {onRefresh ? <RefreshButton onRefresh={onRefresh} /> : null}
    </>
  );

  return (
    <PageContainer surface={surface}>
      <div ref={shellRef} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 data-page-contrast="true" className="page-contrast-fg page-title">
              {title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">{headerActionsSlot}</div>
        </div>
        {isLoading ? (
          <PageSkeleton variant={loadingVariant} message={loadingMessage} />
        ) : (
          <div className="space-y-4">{children}</div>
        )}
      </div>
    </PageContainer>
  );
}

export function SectionCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="dashboard-card p-4">
      <div className="space-y-3">
        {title ? (
          <h2 className="text-base md:text-lg font-semibold text-[var(--comp-text-primary)]">{sanitizeVisibleText(title)}</h2>
        ) : null}
        {children}
      </div>
    </section>
  );
}

/**
 * Standard title bar for a flush table section (`dashboard-card overflow-hidden p-0`).
 * Renders the header row directly above the table so the card reads as one surface.
 */
export function TableCardHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--comp-border)] px-5 py-3">
      <h2 className="card-title">{sanitizeVisibleText(title)}</h2>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  );
}

/**
 * Full-width empty state for use inside a <tbody>: a single colSpan cell wrapping
 * EmptyStateCard's content minus its border, padded py-8.
 */
export function TableEmptyRow({
  colSpan,
  message,
  hint,
}: {
  colSpan: number;
  message: string;
  hint?: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="erp-table-cell p-0">
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          {/* File-question icon — matches the Application Tracker EmptyState icon */}
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ color: "var(--comp-text-muted)", opacity: 0.7 }}
          >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <circle cx="10" cy="13" r="2" />
            <path d="m20 17-1.09-1.09a2 2 0 0 0-2.82 0L10 22" />
          </svg>
          <p className="text-sm font-semibold" style={{ color: "var(--comp-text-primary)" }}>
            {sanitizeVisibleText(message)}
          </p>
          {hint ? (
            <p className="max-w-xs text-xs leading-5" style={{ color: "var(--comp-text-muted)" }}>
              {sanitizeVisibleText(hint)}
            </p>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function StatusBanner({ message }: { message: StatusMessage }) {
  const classNameByTone: Record<StatusTone, string> = {
    success: "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]",
    warning: "border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]",
    info: "border-[color-mix(in_srgb,var(--comp-accent)_25%,transparent)] bg-[var(--comp-surface-hover)] text-[var(--comp-text-primary)]",
    error:
      "border-[color-mix(in_srgb,var(--error)_35%,transparent)] bg-[color-mix(in_srgb,var(--error)_12%,transparent)] text-[var(--error)]",
    locked:
      "border-[color-mix(in_srgb,var(--error)_35%,transparent)] bg-[color-mix(in_srgb,var(--error)_12%,transparent)] text-[var(--error)]",
  };

  return (
    <div className={`rounded-xl border px-3 py-2 text-sm font-medium ${classNameByTone[message.tone]}`}>
      {sanitizeVisibleText(message.text)}
    </div>
  );
}

export function KpiGrid({ items }: { items: KpiItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="dashboard-card p-4">
          <p className="text-sm text-[var(--comp-text-secondary)]">{item.label}</p>
          <div className="mt-1 flex items-end gap-2">
            <p className="text-2xl font-semibold text-[var(--comp-text-primary)]">{item.value}</p>
            {item.trend !== undefined && (
              <span
                className="text-xs font-medium flex items-center gap-1"
                style={{
                  color: item.trend > 0 ? "var(--success)" : "var(--error)",
                }}
              >
                {item.trend > 0 ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
                {item.trendLabel && <span>{item.trendLabel}</span>}
              </span>
            )}
          </div>
          {item.subtitle && (
            <p className="mt-1 text-xs" style={{ color: "var(--comp-text-muted)" }}>{item.subtitle}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// Named ErpDataTable to disambiguate from the generic ui/DataTable: this one
// renders a parsed blueprint DataTableModel, not column definitions.
export function ErpDataTable({ table }: { table: DataTableModel }) {
  if (table.columns.length === 0 || table.rows.length === 0) {
    return <EmptyStateCard message="No table rows available." />;
  }

  return (
    <div className="erp-table-shell">
      {table.title ? (
        <div className="border-b border-[color-mix(in_srgb,var(--comp-accent)_20%,transparent)] bg-[var(--comp-surface)] px-3 py-2 text-sm font-semibold text-[var(--comp-text-primary)]">
          {sanitizeVisibleText(table.title)}
        </div>
      ) : null}
      <div className={table.disableInternalScroll ? "overflow-x-auto" : "max-h-[420px] overflow-auto"}>
        <table className="erp-table text-left">
          <thead className="erp-table-head erp-table-head-sticky">
            <tr>
              {table.columns.map((column) => (
                <th
                  key={column}
                  className={`erp-table-head-cell label-text ${
                    isNumericColumn(column) ? "erp-table-align-right" : ""
                  }`}
                >
                  {sanitizeVisibleText(column, "-")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="erp-table-body">
            {table.rows.map((row, index) => (
              <tr key={`${index}-${row[table.columns[0]] ?? "row"}`} className="erp-table-row">
                {table.columns.map((column) => (
                  <td
                    key={`${index}-${column}`}
                    className={`erp-table-cell max-w-[320px] ${
                      isNumericColumn(column) ? "erp-table-align-right" : ""
                    }`}
                  >
                    {renderCell(column, row[column] || "-")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderCell(column: string, rawValue: string) {
  const value = sanitizeVisibleText(rawValue, "-");
  const normalizedColumn = column.toLowerCase();
  const normalizedValue = value.toLowerCase();

  if (normalizedColumn.includes("result") || normalizedColumn.includes("status")) {
    let toneClass = "erp-status-pill-info";
    if (/pass|captured|success|approved|registered/i.test(normalizedValue)) {
      toneClass = "erp-status-pill-success";
    } else if (/fail|rejected|declined|error/i.test(normalizedValue)) {
      toneClass = "erp-status-pill-error";
    } else if (/pending|open|hold|processing/i.test(normalizedValue)) {
      toneClass = "erp-status-pill-warning";
    }

    return (
      <span className={`erp-status-pill ${toneClass}`}>
        {value}
      </span>
    );
  }

  if (normalizedColumn === "grade" || normalizedColumn.includes("grade point")) {
    return <span className="font-semibold">{value}</span>;
  }

  if (isNumericColumn(column)) {
    return <span className="font-medium tabular-nums">{value}</span>;
  }

  return value;
}

function isNumericColumn(column: string) {
  const normalized = column.toLowerCase();
  return (
    normalized.includes("amount") ||
    normalized.includes("credit") ||
    normalized.includes("mark") ||
    normalized.includes("grade point") ||
    normalized.includes("attempt") ||
    normalized.includes("sgpa") ||
    normalized === "sl.no." ||
    normalized === "semester" ||
    normalized.includes("%")
  );
}

export function EmptyStateCard({
  title = "Nothing to show yet",
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  return <EmptyState title={title} description={message} action={action} className="p-10" />;
}
