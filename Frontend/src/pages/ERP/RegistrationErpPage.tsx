/**
 * RegistrationErpPage — Dedicated renderer for /registration/* ERP pages.
 *
 * Pattern: FeeDuesPage. Fetches live ERP data, renders status + tables,
 * then directs the student to the official portal for submission.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError, type ErpPageResponse, getErpBatch } from "../../lib/erp/index";
import { erpKeys } from "../../lib/erp/queryKeys";
import { extractSections, sanitizeText, type ParsedSection } from "../../lib/erp/sanitize";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { EmptyState, InlineError } from "../../components/ui/Feedback";
import { StatusBadge } from "../../components/ui/Badges";

type Props = { blueprint: PageBlueprint; extraContent?: ReactNode };
type TableRow = Record<string, string>;

// ── Column key humanization ─────────────────────────────────────────────────

/**
 * Map known ERP column keys to human-readable labels.
 */
const COLUMN_LABEL_OVERRIDES: Record<string, string> = {
  sno: "S.No",
  slno: "S.No",
  subcode: "Subject Code",
  subjectcode: "Subject Code",
  subname: "Subject Name",
  subjectname: "Subject Name",
  subdesc: "Description",
  ltpc: "L-T-P-C",
  sem: "Semester",
  semesterno: "Semester",
  faculty: "Faculty",
  venue: "Venue",
  roomno: "Room No",
  grade: "Grade",
  gradepoint: "Grade Point",
  result: "Result",
  credit: "Credit",
  attempt: "Attempt",
  monthyear: "Month & Year",
  status: "Status",
  remarks: "Remarks",
  action: "Action",
  print: "Print",
};

function humanizeColumnKey(key: string): string {
  // Check overrides first (case-insensitive)
  const lower = key.replace(/\s+/g, "").toLowerCase();
  if (COLUMN_LABEL_OVERRIDES[lower]) return COLUMN_LABEL_OVERRIDES[lower];

  // If it already looks human-readable (has spaces, sentence case), keep it
  if (/[a-z][A-Z]/.test(key)) {
    return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // All-caps or uppercase-heavy: title-case it
  if (key === key.toUpperCase() && key.length > 2) {
    return key.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return key;
}

// ── Print/Action link detection ─────────────────────────────────────────────

const PRINT_PATTERN = /^(?:print|download)\b/i;
const ERP_URL_PATTERN = /\.jsp/i;

function isPrintAction(value: string): boolean {
  return PRINT_PATTERN.test(value.trim()) || ERP_URL_PATTERN.test(value);
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim()) || /^\/[a-z]/i.test(value.trim());
}

// ── Registration type metadata ──────────────────────────────────────────────

interface RegMeta {
  portalHeading: string;
  portalNote: string;
  closedHint: string;
  showBuddyFinderNotice?: boolean;
}

const REG_META: Record<string, RegMeta> = {
  "course-registration": {
    portalHeading: "Complete Course Registration",
    portalNote:
      "Course selections and cancellations must be finalised through the official university ERP. The details above reflect your current registered subjects.",
    closedHint:
      "Course registration details were not found for the current session. The registration window may not be open yet.",
  },
  "minor-oe": {
    portalHeading: "Register for Minor / Open Elective",
    portalNote:
      "Minor and Open Elective registrations are processed through the official ERP. Use the portal to submit or modify your selection during the open window.",
    closedHint:
      "No Minor/OE registration data found for the current period. The window may be closed.",
  },
  "exam-registration": {
    portalHeading: "Submit Exam Registration",
    portalNote:
      "Exam registration must be completed on the official ERP portal. Verify the subject list below matches your expected exam schedule before proceeding.",
    closedHint:
      "No exam registration data found for the current semester. The registration window may not have opened yet.",
  },
  hostel: {
    portalHeading: "Apply for Hostel Accommodation",
    portalNote:
      "Hostel bookings and room allocations are managed through the official ERP portal. The information above is your current hostel record.",
    closedHint:
      "No hostel registration record found. Bookings may not be open, or you may not have applied yet.",
    showBuddyFinderNotice: true,
  },
  transport: {
    portalHeading: "Manage Transport Registration",
    portalNote:
      "Transport route selection and changes are handled through the official ERP. The details here reflect your current transport status.",
    closedHint:
      "No transport registration data found. The window may be closed, or you haven't registered yet.",
  },
  sap: {
    portalHeading: "Complete SAP Registration",
    portalNote:
      "SAP registration and submission is managed through the official ERP portal. Ensure supporting documents are uploaded before the deadline.",
    closedHint:
      "No SAP registration information found. The submission window may be closed.",
  },
};

function getRegMeta(route: string): RegMeta {
  for (const [key, meta] of Object.entries(REG_META)) {
    if (route.includes(key)) return meta;
  }
  return {
    portalHeading: "Continue Registration",
    portalNote:
      "This registration must be completed through the official university ERP portal. The data above is pulled live and reflects your current status.",
    closedHint:
      "No registration data found for this category. The registration window may not be open.",
    showBuddyFinderNotice: false,
  };
}


/** Normalise a string for loose duplicate-heading detection. */
function normHeading(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/** Returns true when the section title is essentially the same as the page heading. */
function isTitleRedundant(sectionTitle: string, pageHeading: string): boolean {
  const a = normHeading(sectionTitle);
  const b = normHeading(pageHeading);
  if (!a || !b) return false;
  // Exact match after normalisation, or one contains the other
  return a === b || b.includes(a) || a.includes(b);
}

function isTextRedundant(text: string, reference: string): boolean {
  const t = normHeading(text);
  const r = normHeading(reference);
  if (!t || !r) return false;
  return t === r || t.includes(r) || r.includes(t);
}

function detectStatus(sections: ParsedSection[]): "registered" | "pending" | "not-registered" | null {
  const combined = sections.map((s) => `${s.title} ${s.text}`.toLowerCase()).join(" ");
  if (/registered|confirmed|success|approved|allocated/i.test(combined)) return "registered";
  if (/pending|processing|hold|awaiting/i.test(combined)) return "pending";
  if (/not registered|no registration|not found|no record/i.test(combined)) return "not-registered";
  if (sections.some((s) => s.tables.some((t) => t.length > 0))) return "registered";
  return null;
}

// ── Structured text rendering ───────────────────────────────────────────────

/**
 * Returns true when text contains colon-separated label/value patterns
 * spread across lines or pipe-delimited segments — indicating structured
 * ERP data that should be rendered as key-value cards, not a raw paragraph.
 */
function hasStructuredPatterns(text: string): boolean {
  if (!text || text.length < 10) return false;
  // Count colon-separated pairs — at least 3 indicates a structured dump
  const colonPairs = text.split("\n").filter((line) => /^[A-Za-z][A-Za-z .&/-]{1,40}\s*:/.test(line.trim())).length;
  if (colonPairs >= 3) return true;
  // Pipe-separated label:value groups
  const pipeGroups = text.split("|").filter((part) => /\S+\s*:\s*\S+/.test(part.trim())).length;
  if (pipeGroups >= 2) return true;
  return false;
}

/** Detects ERP notice/alert text that should be styled as a callout box. */
function isNoticeText(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  // Common notice patterns in ERP pages
  return /^Note:/i.test(trimmed) ||
    /^Please note:/i.test(trimmed) ||
    /^Important:/i.test(trimmed) ||
    /Students will be allowed to register for one facility/i.test(trimmed) ||
    /Transport booking will be open/i.test(trimmed);
}

/**
 * Parse colon-separated label:value lines into structured pairs.
 */
function parseStructuredText(text: string): Array<{ label: string; value: string }> {
  const pairs: Array<{ label: string; value: string }> = [];

  // Try pipe-delimited groups first (single-line structured dumps)
  const pipeParts = text.split("|").map((p) => p.trim()).filter(Boolean);
  for (const part of pipeParts) {
    const colonIdx = part.indexOf(":");
    if (colonIdx > 0) {
      const label = part.slice(0, colonIdx).trim();
      const value = part.slice(colonIdx + 1).trim();
      if (label && value && label.length < 60) {
        pairs.push({ label, value });
      }
    }
  }

  if (pairs.length >= 2) return pairs;

  // Try newline-separated label:value lines
  pairs.length = 0;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const label = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      if (label && value && label.length < 60) {
        pairs.push({ label, value });
      }
    }
  }

  return pairs;
}

function StructuredTextField({ text, title }: { text: string; title: string }) {
  const isStructured = hasStructuredPatterns(text);
  const pairs = isStructured ? parseStructuredText(text) : [];
  const isNotice = isNoticeText(text);

  // Notice/alert text: render as a styled callout box
  if (isNotice) {
    return (
      <div
        className="flex items-start gap-3 rounded-xl p-4"
        style={{
          border: "1px solid color-mix(in srgb, var(--comp-warning) 30%, transparent)",
          background: "color-mix(in srgb, var(--comp-warning) 8%, transparent)",
        }}
        role="alert"
      >
        <svg
          className="mt-0.5 shrink-0"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--comp-warning)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" x2="12" y1="9" y2="13" />
          <line x1="12" x2="12.01" y1="17" y2="17" />
        </svg>
        <div className="flex-1 text-sm leading-6" style={{ color: "var(--comp-text-primary)" }}>
          {text}
        </div>
      </div>
    );
  }

  // Structured data: render as a key-value card grid
  if (isStructured && pairs.length >= 2 && pairs.length <= 30) {
    // Group into 2 columns
    const mid = Math.ceil(pairs.length / 2);
    const leftCol = pairs.slice(0, mid);
    const rightCol = pairs.slice(mid);

    return (
      <div
        className="rounded-xl border"
        style={{
          borderColor: "color-mix(in srgb, var(--comp-border) 60%, transparent)",
          background: "color-mix(in srgb, var(--surface) 60%, transparent)",
        }}
      >
        <div className="grid gap-x-6 gap-y-0 md:grid-cols-2">
          <div className="divide-y" style={{ borderColor: "color-mix(in srgb, var(--comp-border) 40%, transparent)" }}>
            {leftCol.map((pair, pi) => (
              <div key={pi} className="flex items-baseline justify-between gap-4 px-4 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider shrink-0" style={{ color: "var(--comp-text-muted)" }}>
                  {pair.label}
                </span>
                <span className="text-sm font-medium text-right" style={{ color: "var(--comp-text-primary)" }}>
                  {pair.value}
                </span>
              </div>
            ))}
          </div>
          <div className="divide-y md:border-l" style={{ borderColor: "color-mix(in srgb, var(--comp-border) 40%, transparent)" }}>
            {rightCol.map((pair, pi) => (
              <div key={pi} className="flex items-baseline justify-between gap-4 px-4 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider shrink-0" style={{ color: "var(--comp-text-muted)" }}>
                  {pair.label}
                </span>
                <span className="text-sm font-medium text-right" style={{ color: "var(--comp-text-primary)" }}>
                  {pair.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Free-form text: render as a clean paragraph
  return (
    <div
      className="rounded-xl border px-4 py-3 text-sm leading-6"
      style={{
        borderColor: "color-mix(in srgb, var(--comp-border) 50%, transparent)",
        color: "var(--comp-text-secondary)",
      }}
    >
      {text}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

const STATUS_MAP = {
  registered: { label: "Registered", preset: "success" },
  pending: { label: "Pending", preset: "warning" },
  "not-registered": { label: "Not Registered", preset: "error" },
} as const;

// File-local renderer over raw rows; named to avoid colliding with the
// shared ui/DataTable and erp ErpDataTable components.
function RegistrationRowsTable({ rows }: { rows: TableRow[] }) {
  if (!rows.length) return null;
  const columns = Object.keys(rows[0]);

  // Detect if any column has print action values
  const printColIndex = columns.findIndex((col) => {
    const colLower = col.toLowerCase().replace(/\s+/g, "");
    if (colLower === "print" || colLower === "action") return true;
    return rows.some((row) => isPrintAction(row[col] || ""));
  });

  return (
    <div className="erp-table-shell overflow-x-auto">
      <table className="erp-table text-left">
        <thead className="erp-table-head">
          <tr>
            {columns.map((col, ci) => (
              <th
                key={col}
                className={`erp-table-head-cell label-text${ci === printColIndex ? " text-center w-[80px]" : ""}`}
              >
                {humanizeColumnKey(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="erp-table-body">
          {rows.map((row, i) => (
            <tr key={i} className="erp-table-row">
              {columns.map((col, ci) => {
                const value = row[col] || "";
                const isPrint = ci === printColIndex && isPrintAction(value);

                return (
                  <td
                    key={col}
                    className={`erp-table-cell${ci === 0 ? " erp-table-cell-strong" : ""}${isPrint ? " text-center" : ""}`}
                    style={{ maxWidth: isPrint ? undefined : 320 }}
                  >
                    {isPrint ? (
                      isUrl(value) ? (
                        <a
                          href={value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide no-underline transition-colors hover:opacity-80"
                          style={{
                            borderColor: "var(--comp-border)",
                            color: "var(--comp-text-primary)",
                            background: "color-mix(in srgb, var(--comp-surface) 80%, transparent)",
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="6 9 6 2 18 2 18 9" />
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                            <rect x="6" y="14" width="12" height="8" />
                          </svg>
                          Print
                        </a>
                      ) : (
                        <span
                          className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors hover:opacity-80"
                          style={{
                            borderColor: "var(--comp-border)",
                            color: "var(--comp-text-primary)",
                            background: "color-mix(in srgb, var(--comp-surface) 80%, transparent)",
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="6 9 6 2 18 2 18 9" />
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                            <rect x="6" y="14" width="12" height="8" />
                          </svg>
                          {value || "Print"}
                        </span>
                      )
                    ) : (
                      value || "\u2014"
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PortalCta({ meta }: { meta: RegMeta }) {
  return (
    <div
      className="flex items-start gap-4 rounded-xl p-5"
      style={{
        border: "1px solid color-mix(in srgb, var(--comp-accent) 20%, transparent)",
        background: "color-mix(in srgb, var(--comp-accent) 5%, transparent)",
      }}
    >
      <svg
        className="mt-0.5 shrink-0"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--comp-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" x2="21" y1="14" y2="3" />
      </svg>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold" style={{ color: "var(--comp-text-primary)" }}>
          {meta.portalHeading}
        </h3>
        <p
          className="mt-1 text-sm leading-6"
          style={{ color: "var(--comp-text-secondary)" }}
        >
          {meta.portalNote}
        </p>
        <a
          href="https://erp.srmist.edu.in"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-4 gap-2 no-underline"
          style={{ display: "inline-flex" }}
        >
          Open Official ERP
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" x2="21" y1="14" y2="3" />
          </svg>
        </a>
      </div>
    </div>
  );
}

function EmptyRegistration({ meta }: { meta: RegMeta }) {
  return (
    <div className="space-y-6">
      <EmptyState
        title="No registration data available"
        description={meta.closedHint}
      />
      <PortalCta meta={meta} />
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function RegistrationErpPage({ blueprint, extraContent }: Props) {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const meta = getRegMeta(blueprint.route);
  const { fetchKeys } = blueprint;

  const batchQuery = useQuery({
    queryKey: [...erpKeys.batch(fetchKeys), tick],
    queryFn: async () => {
      if (!fetchKeys.length) {
        throw new ApiError("No ERP fetch keys configured.", 500, "NO_FETCH_KEYS", false);
      }
      return getErpBatch(fetchKeys);
    },
    staleTime: 60_000,
  });

  const [error, setError] = useState<string | null>(null);
  const responsesByKey: Record<string, ErpPageResponse> = useMemo(() => {
    const batch = batchQuery.data;
    if (!batch) return {};
    const ok: Record<string, ErpPageResponse> = {};
    for (const key of blueprint.fetchKeys) {
      const r = batch[key];
      if (r && (r as any).success !== false) {
        ok[key] = r as ErpPageResponse;
      }
    }
    return ok;
  }, [batchQuery.data, blueprint.fetchKeys]);

  useEffect(() => {
    if (!batchQuery.error) return;
    setError(batchQuery.error instanceof Error ? batchQuery.error.message : "Failed to load page");
  }, [batchQuery.error]);

  useEffect(() => {
    const batch = batchQuery.data;
    if (!batch || Object.keys(responsesByKey).length > 0) return;

    let firstFailure = "Failed to load registration data";
    for (const key of blueprint.fetchKeys) {
      const r = batch[key];
      if (!r || (r as any).success === false) {
        firstFailure = sanitizeText((r as any)?.error) || `Failed to load ${key}`;
        break;
      }
    }
    setError(firstFailure);
  }, [batchQuery.data, responsesByKey, blueprint.fetchKeys]);

  const loading = batchQuery.isPending;

  const sections = extractSections(responsesByKey);
  const hasContent = sections.some((s) => s.tables.some((t) => t.length > 0) || s.text || s.title);
  const status = hasContent ? detectStatus(sections) : null;

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Live ERP"
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage || `Loading ${blueprint.heading.toLowerCase()}\u2026`}
      onRefresh={refresh}
    >
      {error && <InlineError message={error} onRetry={refresh} />}

      {!loading && !error && !hasContent && <EmptyRegistration meta={meta} />}

      {hasContent && (
        <div className="space-y-6">
          {/* Status row */}
          {status && (
            <div className="flex items-center gap-3">
              <StatusBadge label={STATUS_MAP[status].label} preset={STATUS_MAP[status].preset} dot />
              <span className="text-xs text-[var(--comp-text-muted)]">
                Live data from university ERP
              </span>
            </div>
          )}

          {/* Data sections — rendered flat, no nested cards */}
          {sections.map((section, i) => (
            <div key={i} className="space-y-3">
              {section.title && !isTitleRedundant(section.title, blueprint.heading) && (
                <h2
                  className="text-sm font-semibold"
                  style={{ color: "var(--comp-text-primary)" }}
                >
                  {section.title}
                </h2>
              )}

              {/* Text-only section: render as structured key-value cards */}
              {section.text && section.tables.length === 0 && (
                (!section.title || isTitleRedundant(section.title, blueprint.heading) || !isTextRedundant(section.text, section.title)) ? (
                  <StructuredTextField text={section.text} title={section.title} />
                ) : null
              )}

              {/* Table sections */}
              {section.tables.map((rows, ti) => (
                <RegistrationRowsTable key={ti} rows={rows} />
              ))}
            </div>
          ))}

          {/* Portal CTA */}
          <PortalCta meta={meta} />
        </div>
      )}

      {/* Optional page-specific extensions (e.g. Buddy Finder, route admin)
          rendered inside this shell so gutters stay aligned with the inset
          content above regardless of load state. */}
      {extraContent}
    </ErpPageShell>
  );
}
