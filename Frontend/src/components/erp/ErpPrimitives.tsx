import { useRef, type ReactNode } from "react";
import { usePageContrast } from "../../hooks/usePageContrast";

const INTERNAL_JSP_PATH_PATTERN = /\b(?:[a-z0-9_-]+\/)+[a-z0-9_-]+\.jsp(?:\?[^\s]*)?\b/gi;
const VISIBLE_TEXT_NOISE_PATTERN =
  /(function\s+[a-z0-9_]+\s*\(|\$\(|\.jsp\b|validationengine|ajaxparameter|e\.preventdefault|window\.open|document\.getelementbyid|@page\b|^var\s+[a-z0-9_]+\s*=|font-size\s*:|font-family\s*:|background(?:-color)?\s*:|text-align\s*:|font-weight\s*:|padding\s*:|border(?:-collapse)?\s*:|color\s*:|dialog\(|alert\(|\$.post\(|\$.ajax\()/i;

function stripVisibleTextNoise(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || !VISIBLE_TEXT_NOISE_PATTERN.test(normalized)) {
    return normalized;
  }

  const fragments = normalized
    .replace(/([;{}])/g, "$1\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !VISIBLE_TEXT_NOISE_PATTERN.test(line))
    .filter((line) => !/^[$@.#]/.test(line))
    .filter((line) => !/^\w+\([^)]*\)$/.test(line));

  return fragments.join(" ").replace(/\s+/g, " ").trim();
}

export function sanitizeVisibleText(value: unknown, fallback = "") {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;

  const withoutInternalPaths = normalized.replace(INTERNAL_JSP_PATH_PATTERN, " ");
  let sanitized = stripVisibleTextNoise(withoutInternalPaths);
  
  // 1. Convert ALL CAPS text to Title Case (ignoring pure numbers or tiny abbreviations)
  if (sanitized === sanitized.toUpperCase() && sanitized.length > 2 && /[A-Z]/.test(sanitized)) {
      sanitized = sanitized.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
      );
  }
  
  // 2. Fix spacing around parentheses/brackets
  sanitized = sanitized.replace(/([a-zA-Z0-9])\(/g, "$1 (");
  sanitized = sanitized.replace(/ \)/g, ")");
  sanitized = sanitized.replace(/\( /g, "(");
  
  // 3. Clean up internal Form IDs (e.g., frmStudentFeeDueDetails -> Fee Due Details)
  if (sanitized.match(/^frm[A-Z]/i) || sanitized.toLowerCase().includes('frmstudent')) {
      sanitized = sanitized
        .replace(/^frmStudent/i, '')
        .replace(/^frm/i, '')
        .replace(/([A-Z])/g, ' $1')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
  }

  return sanitized || fallback;
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
  children: ReactNode;
}

export function ErpPageShell({
  title,
  source,
  updatedAt,
  isLoading = false,
  loadingMessage = "Loading...",
  onRefresh,
  headerActions,
  children,
}: ErpPageShellProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  usePageContrast(shellRef, [title, source, updatedAt, isLoading]);

  return (
    <div ref={shellRef} className="relative min-h-screen p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 data-page-contrast="true" className="page-contrast-fg text-2xl font-bold">
            {title}
          </h1>
          {/* Debug info hidden in production */}
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

        <div className="flex items-center gap-3">
          {headerActions}
          {onRefresh && (
            <button
              type="button"
              data-page-contrast="true"
              onClick={onRefresh}
              className="page-contrast-outline flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition hover:bg-[color-mix(in_srgb,var(--surface)_20%,transparent)]"
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
          )}
        </div>
      </div>

      <div className="space-y-6">{children}</div>

      {isLoading ? <PageLoadingOverlay message={loadingMessage} /> : null}
    </div>
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
    <div className="pointer-events-auto absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 backdrop-blur-sm bg-slate-900/8">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#F8F8F8] border-t-[#0A3035]" />
      <p data-page-contrast="true" className="page-contrast-fg text-sm font-medium">{message}</p>
    </div>
  );
}

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="dashboard-card p-4 md:p-5">
      <h2 className="mb-3 text-lg font-semibold text-[#0A3035]">{sanitizeVisibleText(title, "Section")}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function StatusBanner({ message }: { message: StatusMessage }) {
  const classNameByTone: Record<StatusTone, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    info: "border-[#0A3035]/25 bg-[#F8F8F8] text-[#0A3035]",
    locked: "border-rose-200 bg-rose-50 text-rose-800",
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
          <p className="text-sm text-slate-600">{item.label}</p>
          <p className="mt-1 text-2xl font-semibold text-[#0A3035]">{item.value}</p>
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
        <div className="border-b border-[#0A3035]/20 bg-[#FFFFFF] px-3 py-2 text-sm font-semibold text-[#0A3035]">
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
                  className={`erp-table-head-cell ${
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
    <div className="dashboard-card border-dashed p-5 text-sm font-medium text-slate-600">
      {message}
    </div>
  );
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString();
}
