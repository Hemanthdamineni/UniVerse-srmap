// ErpPageShell: optional section-card layout for ERP data pages; loading uses SkeletonBlock instead of spinners.
import { useRef, type ReactNode } from "react";
import { usePageContrast } from "../../hooks/usePageContrast";
import { sanitizeErpDisplayText } from "../../lib/erp/displayText";
import { PageContainer } from "../layout/PageLayouts";
import { SkeletonBlock } from "../ui/Skeletons";

export function sanitizeVisibleText(value: unknown, fallback = "") {
  return sanitizeErpDisplayText(value, fallback);
}

export type PageSourceLabel =
  | "Live ERP"
  | "Dump Snapshot"
  | "External SQLite"
  | "Internal API"
  | "Placeholder";

export type StatusTone = "success" | "warning" | "info" | "locked";

export interface KpiItem {
  label: string;
  value: string;
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
  onRefresh,
  headerActions,
  surface = "card",
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
    <PageContainer className="relative" surface={surface}>
      <div ref={shellRef}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 data-page-contrast="true" className="page-contrast-fg page-title text-xl md:text-2xl">
              {title}
            </h1>
            <div className="hidden">
              <SourceBadge source={source} />
              {updatedAt ? (
                <span
                  data-page-contrast="true"
                  className="page-contrast-chip rounded-full border px-3 py-1 text-xs font-medium"
                >
                  Updated {formatTimestamp(updatedAt)}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3">{headerActionsSlot}</div>
        </div>
        <div className="space-y-4">{children}</div>
      </div>

      {isLoading ? <PageLoadingOverlay message={loadingMessage} /> : null}
    </PageContainer>
  );
}

function SourceBadge({ source }: { source: PageSourceLabel }) {
  const classNameBySource: Record<PageSourceLabel, string> = {
    "Live ERP": "",
    "Dump Snapshot": "opacity-95",
    "External SQLite": "opacity-95",
    "Internal API": "opacity-95",
    Placeholder: "opacity-90",
  };

  return (
    <span
      data-page-contrast="true"
      className={`page-contrast-chip rounded-full border px-3 py-1 text-xs font-semibold ${classNameBySource[source]}`}
    >
      {source}
    </span>
  );
}

function PageLoadingOverlay({ message }: { message: string }) {
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 backdrop-blur-sm px-6"
      style={{ background: "color-mix(in srgb, var(--comp-accent) 6%, transparent)" }}
    >
      <SkeletonBlock width={200} height={12} className="max-w-full rounded-full" />
      <SkeletonBlock width={140} height={12} className="max-w-full rounded-full" />
      <SkeletonBlock width={80} height={40} className="rounded-lg" />
      <p data-page-contrast="true" className="page-contrast-fg body-text text-center font-medium">
        {message}
      </p>
    </div>
  );
}

export function SectionCard({ title = "Section", children }: { title?: string; children: ReactNode }) {
  return (
    <section className="dashboard-card p-3 md:p-4">
      <h2 className="mb-2 text-base md:text-lg font-semibold text-[var(--comp-text-primary)]">{sanitizeVisibleText(title, "Section")}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function StatusBanner({ message }: { message: StatusMessage }) {
  const classNameByTone: Record<StatusTone, string> = {
    success: "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]",
    warning: "border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]",
    info: "border-[color-mix(in_srgb,var(--comp-accent)_25%,transparent)] bg-[var(--comp-surface-hover)] text-[var(--comp-text-primary)]",
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
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="dashboard-card p-4">
          <p className="text-sm text-[var(--comp-text-secondary)]">{item.label}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--comp-text-primary)]">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function DataTable({ table }: { table: DataTableModel }) {
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

export function EmptyStateCard({ message }: { message: string }) {
  return (
    <div className="dashboard-card border-dashed p-6 text-sm font-medium text-[var(--comp-text-secondary)]">
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--comp-border)] bg-[var(--comp-surface-hover)] text-base font-semibold text-[var(--comp-text-primary)]">
          i
        </div>
        <p>{message}</p>
      </div>
    </div>
  );
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString();
}
