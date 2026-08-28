/**
 * CourseFeedbackAssistantPage — Unified feedback page combining ERP data view + feedback submission assistant.
 *
 * Pattern: RegistrationErpPage. Fetches live ERP data via blueprint.fetchKeys, renders structured
 * sections + tables, then provides the interactive feedback assistant for submission.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ApiError, type ErpPageResponse, getErpBatch } from "../../lib/erp/index";
import { erpKeys } from "../../lib/erp/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { extractSections, sanitizeText, type ParsedSection } from "../../lib/erp/sanitize";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { EmptyState, InlineError } from "../../components/ui/Feedback";
import { StatusBadge } from "../../components/ui/Badges";
import { ClearanceCard } from "../../components/ui/ClearanceCard";
import { ConfirmDialog } from "../../components/dialog";
import {
  getEndSemesterFeedbackStatus,
  getRandomFeedbackTemplate,
  submitEndSemesterFeedback,
  type FeedbackStatusResponse,
  type FeedbackSubmitResponse,
  validateFeedbackComment,
} from "../../lib/campus/studentToolsApi";
import { ClipboardCheck, MessageSquare } from "lucide-react";

const DocumentErpPage = lazy(() => import("../ERP/DocumentErpPage"));

// Raw mode fallback component
function RawErpFallback({ blueprint, onBack }: { blueprint: PageBlueprint; onBack: () => void }) {
  return (
    <div>
      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_20%,transparent)] bg-[var(--comp-surface)] px-4 py-2 text-sm font-medium text-[var(--comp-text-primary)] transition hover:bg-[var(--comp-accent)] hover:text-white"
        >
          Back To Feedback Assistant
        </button>
      </div>
      <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center"><div className="animate-pulse text-sm text-[var(--comp-text-muted)]">Loading raw ERP view…</div></div>}>
        <DocumentErpPage
          blueprint={{
            route: blueprint.route,
            heading: "Raw ERP Feedback Page",
            fetchKeys: ["feedback/end-semester-feedback"],
            domain: blueprint.domain,
            sourceMode: "erp",
            integrationState: "native",
            renderer: "document",
            loadingMessage: "Loading raw feedback page...",
          }}
        />
      </Suspense>
    </div>
  );
}

type Props = { blueprint: PageBlueprint };
type TableRow = Record<string, string>;

// ── Column key humanization (copied from RegistrationErpPage) ──────────────────

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
  const lower = key.replace(/\s+/g, "").toLowerCase();
  if (COLUMN_LABEL_OVERRIDES[lower]) return COLUMN_LABEL_OVERRIDES[lower];
  if (/[a-z][A-Z]/.test(key)) {
    return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (key === key.toUpperCase() && key.length > 2) {
    return key.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return key;
}

// ── Print/Action link detection ───────────────────────────────────────────────

const PRINT_PATTERN = /^(?:print|download)\b/i;
const ERP_URL_PATTERN = /\.jsp/i;

function isPrintAction(value: string): boolean {
  return PRINT_PATTERN.test(value.trim()) || ERP_URL_PATTERN.test(value);
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim()) || /^\/[a-z]/i.test(value.trim());
}

// ── Status detection ──────────────────────────────────────────────────────────

function detectStatus(sections: ParsedSection[]): "registered" | "pending" | "not-registered" | null {
  const combined = sections.map((s) => `${s.title} ${s.text}`.toLowerCase()).join(" ");
  if (/feedback not enabled|not enabled|closed/i.test(combined)) return "not-registered";
  if (/pending|available|open/i.test(combined)) return "pending";
  if (/submitted|completed|done/i.test(combined)) return "registered";
  if (sections.some((s) => s.tables.some((t) => t.length > 0))) return "registered";
  return null;
}

// ── Structured text rendering (copied from RegistrationErpPage) ───────────────

function hasStructuredPatterns(text: string): boolean {
  if (!text || text.length < 10) return false;
  const colonPairs = text.split("\n").filter((line) => /^[A-Za-z][A-Za-z .&/-]{1,40}\s*:/.test(line.trim())).length;
  if (colonPairs >= 3) return true;
  const pipeGroups = text.split("|").filter((part) => /\S+\s*:\s*\S+/.test(part.trim())).length;
  if (pipeGroups >= 2) return true;
  return false;
}

function parseStructuredText(text: string): Array<{ label: string; value: string }> {
  const pairs: Array<{ label: string; value: string }> = [];
  const pipeParts = text.split("|").map((p) => p.trim()).filter(Boolean);
  for (const part of pipeParts) {
    const colonIdx = part.indexOf(":");
    if (colonIdx > 0) {
      const label = part.slice(0, colonIdx).trim();
      const value = part.slice(colonIdx + 1).trim();
      if (label && value && label.length < 60) pairs.push({ label, value });
    }
  }
  if (pairs.length >= 2) return pairs;
  pairs.length = 0;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const label = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      if (label && value && label.length < 60) pairs.push({ label, value });
    }
  }
  return pairs;
}

function StructuredTextField({ text }: { text: string; title?: string }) {
  const isStructured = hasStructuredPatterns(text);
  const pairs = isStructured ? parseStructuredText(text) : [];

  if (isStructured && pairs.length >= 2 && pairs.length <= 30) {
    const mid = Math.ceil(pairs.length / 2);
    const leftCol = pairs.slice(0, mid);
    const rightCol = pairs.slice(mid);

    return (
      <div
        className="rounded-xl border"
        style={{
          borderColor: "color-mix(in srgb, var(--comp-border) 60%, transparent)",
          background: "color-mix(in srgb, var(--surface) 60%, var(--background))",
        }}
      >
        <div className="grid gap-x-6 gap-y-0 md:grid-cols-2">
          <div className="divide-y" style={{ borderColor: "color-mix(in srgb, var(--comp-border) 40%, transparent)" }}>
            {leftCol.map((pair, pi) => (
              <div key={pi} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
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
              <div key={pi} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
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

  return (
    <div
      className="rounded-xl border px-4 py-3 text-sm leading-6"
      style={{
        borderColor: "color-mix(in srgb, var(--comp-border) 50%, transparent)",
        backgroundColor: "var(--background)",
        color: "var(--comp-text-secondary)",
      }}
    >
      {text}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const STATUS_MAP = {
  registered: { label: "Completed", preset: "success" },
  pending: { label: "Available", preset: "warning" },
  "not-registered": { label: "Not Available", preset: "error" },
} as const;

// File-local renderer over raw rows; named to avoid colliding with the
// shared ui/DataTable and erp ErpDataTable components.
function FeedbackRowsTable({ rows }: { rows: TableRow[] }) {
  if (!rows.length) return null;
  const columns = Object.keys(rows[0]);

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
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide no-underline transition-colors hover:opacity-80"
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
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors hover:opacity-80"
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
                      value || "—"
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

// ── Portal CTA (matches RegistrationErpPage's PortalCta) ──────────────────────

interface PortalMeta {
  portalHeading: string;
  portalNote: string;
  closedHint: string;
}

function getPortalMeta(route: string): PortalMeta {
  if (route.includes("course-feedback")) {
    return {
      portalHeading: "View Raw ERP Feedback Page",
      portalNote:
        "The raw end-semester feedback page from the university ERP. Use this if the assistant doesn't show your current data or you prefer the official interface.",
      closedHint:
        "No feedback data found for the current session. The feedback window may not be open yet.",
    };
  }
  return {
    portalHeading: "Open Raw ERP Page",
    portalNote:
      "This page must be accessed through the official university ERP portal. The data above is pulled live and reflects your current status.",
    closedHint:
      "No data found for this category. The window may not be open.",
  };
}

function PortalCta({ meta }: { meta: PortalMeta }) {
  return (
    <div
      className="flex items-start gap-4 rounded-xl p-5"
      style={{
        border: "1px solid color-mix(in srgb, var(--comp-accent) 20%, transparent)",
        background: "color-mix(in srgb, var(--comp-accent) 5%, var(--background))",
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
        <p className="mt-1 text-sm leading-6" style={{ color: "var(--comp-text-secondary)" }}>
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

function EmptyRegistration({ meta }: { meta: PortalMeta }) {
  return (
    <div className="space-y-5">
      <EmptyState title="No feedback data available" description={meta.closedHint} />
      <PortalCta meta={meta} />
    </div>
  );
}

// ── Feedback Assistant Section ────────────────────────────────────────────────

function FeedbackAssistantSection({
  status,
  optionNo,
  setOptionNo,
  comment,
  setComment,
  templateLoading,
  fetchTemplate,
  submitting,
  handleSubmit,
  commentError,
  submitResult,
  pendingSubjects,
  disabled,
}: {
  status: FeedbackStatusResponse | null;
  optionNo: number;
  setOptionNo: (n: number) => void;
  comment: string;
  setComment: (c: string) => void;
  templateLoading: boolean;
  fetchTemplate: (force?: boolean) => Promise<void>;
  submitting: boolean;
  handleSubmit: () => Promise<void>;
  commentError: string;
  submitResult: FeedbackSubmitResponse | null;
  pendingSubjects: Array<{ id?: string; name: string }>;
  disabled: boolean;
}) {
  if (disabled) {
    return (
      <ClearanceCard
        title="Feedback Not Available"
        description="End-semester feedback is not currently available. This is normal between feedback cycles."
        iconColor="var(--comp-accent)"
        iconBgColor="color-mix(in srgb, var(--comp-accent) 12%, transparent)"
        icon={<MessageSquare className="w-8 h-8" />}
      />
    );
  }

  if (pendingSubjects.length === 0 && status) {
    return (
      <ClearanceCard
        title={status.alreadySubmitted ? "All Feedback Submitted" : "No Pending Subjects"}
        description={status.alreadySubmitted
          ? "Everything already looks submitted for this cycle."
          : "No pending subjects were detected right now."}
        iconColor="var(--success)"
        iconBgColor="color-mix(in srgb, var(--success) 12%, transparent)"
        icon={<ClipboardCheck className="w-8 h-8" />}
      />
    );
  }

  return (
    <>
      {/* KPI Row */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
          <p className="text-sm text-[var(--text-secondary)]">Pending Subjects</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">{status?.totalPending ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
          <p className="text-sm text-[var(--text-secondary)]">Default Rating</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">{status?.defaultOption ?? 5}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
          <p className="text-sm text-[var(--text-secondary)]">Template Ready</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">
            {status?.templateAvailable ? "Yes" : "No"}
          </p>
        </div>
      </div>

      {/* Pending Subject List */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--comp-text-primary)]">Pending Subject List</p>
            <p className="text-sm text-[var(--text-secondary)]">
              Review which subjects will be included before you submit the batch.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {pendingSubjects.map((subject) => (
            <span
              key={subject.id || subject.name}
              className="rounded-full bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)] px-3 py-2 text-sm font-medium text-[var(--comp-text-primary)]"
            >
              {subject.name}
            </span>
          ))}
        </div>
      </div>

      {/* Feedback Form */}
      <div className="space-y-4">
        <div>
          <label htmlFor="feedback-option" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
            Rating Option
          </label>
          <select
            id="feedback-option"
            value={optionNo}
            onChange={(event) => setOptionNo(Number(event.target.value))}
            disabled={submitting}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
          >
            <option value={5}>5 - Strongly Agree</option>
            <option value={4}>4 - Somewhat Agree</option>
            <option value={3}>3 - Neutral</option>
            <option value={2}>2 - Somewhat Disagree</option>
            <option value={1}>1 - Strongly Disagree</option>
          </select>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="feedback-comment" className="text-sm font-medium text-[var(--text-primary)]">
              Descriptive Comment
            </label>
            <button
              type="button"
              onClick={() => void fetchTemplate(true)}
              disabled={templateLoading || submitting}
              className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_20%,transparent)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--comp-text-primary)] transition hover:bg-[var(--comp-accent)] hover:text-white"
            >
              {templateLoading ? "Refreshing..." : "Refresh Template"}
            </button>
          </div>
          <textarea
            id="feedback-comment"
            rows={7}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={submitting}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm leading-6 outline-none focus:border-[var(--comp-accent)]"
            placeholder="Write a clear and constructive course feedback comment."
          />
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className={commentError ? "text-[var(--error)]" : "text-[var(--text-secondary)]"}>
              {commentError || "Use one thoughtful comment for the full batch."}
            </span>
            <span className="text-[var(--text-secondary)]">{comment.trim().length}/500</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting || Boolean(commentError)}
          className="w-full rounded-2xl bg-[var(--comp-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--text-secondary)]"
        >
          {submitting ? "Submitting Feedback..." : `Submit For ${pendingSubjects.length} Subject${pendingSubjects.length === 1 ? "" : "s"}`}
        </button>

        <p className="text-xs leading-6 text-[var(--text-secondary)]">
          This helper only submits after you confirm. Manual captcha and your current ERP session remain the
          source of truth.
        </p>
      </div>

      {/* Submit Result */}
      {submitResult ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">Latest Batch Result</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] p-4">
              <p className="text-sm text-[var(--success)]">Submitted</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--success)]">{submitResult.counts.submitted}</p>
            </div>
            <div className="rounded-2xl border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] p-4">
              <p className="text-sm text-[var(--warning)]">Skipped</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--warning)]">{submitResult.counts.skipped}</p>
            </div>
            <div className="rounded-2xl border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] p-4">
              <p className="text-sm text-[var(--error)]">Failed</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--error)]">{submitResult.counts.failed}</p>
            </div>
          </div>

          <div className="erp-table-shell rounded-2xl">
            <table className="erp-table text-left">
              <thead className="erp-table-head">
                <tr>
                  <th className="erp-table-head-cell label-text">Subject</th>
                  <th className="erp-table-head-cell label-text">Status</th>
                  <th className="erp-table-head-cell label-text">Message</th>
                </tr>
              </thead>
              <tbody className="erp-table-body">
                {submitResult.results.map((result) => (
                  <tr key={`${result.subjectId}-${result.subjectName}`} className="erp-table-row">
                    <td className="erp-table-cell erp-table-cell-strong">{result.subjectName}</td>
                    <td className="erp-table-cell">
                      <span
                        className={`erp-status-pill ${
                          result.status === "submitted"
                            ? "erp-status-pill-success"
                            : result.status === "skipped"
                              ? "erp-status-pill-warning"
                              : "erp-status-pill-error"
                        }`}
                      >
                        {result.status}
                      </span>
                    </td>
                    <td className="erp-table-cell">{result.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CourseFeedbackAssistantPage({ blueprint }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawMode = searchParams.get("mode") === "raw";

  // ERP data state (like RegistrationErpPage)
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  // Feedback assistant state
  const [status, setStatus] = useState<FeedbackStatusResponse | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<FeedbackSubmitResponse | null>(null);
  const [optionNo, setOptionNo] = useState(5);
  const [comment, setComment] = useState("");
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);

  const commentError = useMemo(() => validateFeedbackComment(comment), [comment]);

  const toggleRawMode = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    if (rawMode) {
      next.delete("mode");
    } else {
      next.set("mode", "raw");
    }
    setSearchParams(next, { replace: true });
  }, [rawMode, searchParams, setSearchParams]);

  // Fetch ERP page data via React Query (same pattern as RegistrationErpPage).
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

  const loading = batchQuery.isPending;

  useEffect(() => {
    if (!batchQuery.error) return;
    setError(batchQuery.error instanceof Error ? batchQuery.error.message : "Failed to load page");
  }, [batchQuery.error]);

  const responsesByKey: Record<string, ErpPageResponse> = useMemo(() => {
    const batch = batchQuery.data;
    if (!batch) return {};
    const ok: Record<string, ErpPageResponse> = {};
    for (const key of fetchKeys) {
      const r = batch[key];
      if (r && (r as any).success !== false) {
        ok[key] = r as ErpPageResponse;
      }
    }
    return ok;
  }, [batchQuery.data, fetchKeys]);

  useEffect(() => {
    const batch = batchQuery.data;
    if (!batch || Object.keys(responsesByKey).length > 0) return;

    let firstFailure = "Failed to load feedback data";
    for (const key of fetchKeys) {
      const r = batch[key];
      if (!r || (r as any).success === false) {
        firstFailure = sanitizeText((r as any)?.error) || `Failed to load ${key}`;
        break;
      }
    }
    setError(firstFailure);
  }, [batchQuery.data, responsesByKey, fetchKeys]);

  // Fetch feedback status (from internal API)
  const fetchTemplate = useCallback(async (force = false) => {
    setTemplateLoading(true);
    try {
      const template = await getRandomFeedbackTemplate();
      if (template.available && template.comment) {
        setComment((current) => (force || !current ? template.comment : current));
      }
    } catch {
      // A missing template should not block the page.
    } finally {
      setTemplateLoading(false);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const nextStatus = await getEndSemesterFeedbackStatus();
      setStatus(nextStatus);
      setOptionNo(nextStatus.defaultOption || 5);
      await fetchTemplate(false);
    } catch {
      // Status loading failure is non-fatal; ERP data will show the raw state
    }
  }, [fetchTemplate]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus, tick]);

  const handleSubmit = async () => {
    if (commentError) {
      setError(commentError);
      return;
    }

    const pendingSubjects = status?.pendingSubjects || [];
    if (!pendingSubjects.length) {
      setError("There are no pending subjects to submit right now.");
      return;
    }

    setConfirmingSubmit(true);
  };

  async function handleConfirmedSubmit() {
    const pendingSubjects = status?.pendingSubjects || [];
    if (!pendingSubjects.length) return;

    setConfirmingSubmit(false);
    setSubmitting(true);
    setError(null);
    try {
      const response = await submitEndSemesterFeedback({
        optionNo,
        comment,
        subjectIds: pendingSubjects.map((subject) => subject.id || "").filter(Boolean),
      });
      setSubmitResult(response);
      await loadStatus();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Couldn't submit your feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Raw mode: show DocumentErpPage fallback
  if (rawMode) {
    return <RawErpFallback blueprint={blueprint} onBack={toggleRawMode} />;
  }

  // Parse ERP sections
  const sections = extractSections(responsesByKey);
  const hasContent = sections.some((s) => s.tables.some((t) => t.length > 0) || s.text || s.title);
  const erpStatus = hasContent ? detectStatus(sections) : null;
  const pendingSubjects = status?.pendingSubjects || [];
  const disabled = !status?.enabled;

  const meta = getPortalMeta(blueprint.route);

  // When feedback is disabled, the assistant shows its own empty state.
  // In that case, don't show the redundant ERP data sections below.
  const showErpData = !disabled && hasContent;
  // Also hide the generic EmptyRegistration when disabled (assistant shows its own empty state)
  const showEmptyRegistration = !disabled && !hasContent;

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Live ERP"
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage || `Loading ${blueprint.heading.toLowerCase()}…`}
      onRefresh={refresh}
    >
      {error && <InlineError message={error} onRetry={refresh} />}

      {/* Feedback Assistant Section — at top */}
      {!loading && !error && (
        <div className="space-y-6">
          <div className="dashboard-card p-3 md:p-4">
            <h2 className="mb-4 text-base md:text-lg font-semibold text-[var(--comp-text-primary)]">Feedback Assistant</h2>
            <FeedbackAssistantSection
              status={status}
              optionNo={optionNo}
              setOptionNo={setOptionNo}
              comment={comment}
              setComment={setComment}
              templateLoading={templateLoading}
              fetchTemplate={fetchTemplate}
              submitting={submitting}
              handleSubmit={handleSubmit}
              commentError={commentError}
              submitResult={submitResult}
              pendingSubjects={pendingSubjects}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {/* ERP Data sections — at bottom (only when assistant doesn't show an empty state) */}
      {!loading && !error && showEmptyRegistration && <EmptyRegistration meta={meta} />}

      {showErpData && (
        <div className="space-y-6 pt-4 border-t" style={{ borderColor: "var(--comp-border)" }}>
          {/* Status row */}
          {erpStatus && (
            <div className="flex items-center gap-3">
              <StatusBadge label={STATUS_MAP[erpStatus].label} preset={STATUS_MAP[erpStatus].preset} dot />
              <span className="text-xs text-[var(--comp-text-muted)]">
                Live data from university ERP
              </span>
            </div>
          )}

          {/* ERP Data sections — rendered flat, no nested cards */}
          {sections.map((section, i) => (
            <div key={i} className="space-y-3">
              {section.title && (
                <h2 className="text-sm font-semibold" style={{ color: "var(--comp-text-primary)" }}>
                  {section.title}
                </h2>
              )}

              {/* Text-only section: render as structured key-value cards */}
              {section.text && section.tables.length === 0 && (
                <StructuredTextField text={section.text} />
              )}

              {/* Table sections */}
              {section.tables.map((rows, ti) => (
                <FeedbackRowsTable key={ti} rows={rows} />
              ))}

              {i < sections.length - 1 && (
                <hr style={{ border: "none", borderTop: "1px solid var(--comp-border)", margin: "var(--space-md) 0" }} />
              )}
            </div>
          ))}

          {/* Portal CTA */}
          <PortalCta meta={meta} />
        </div>
      )}

      {/* Portal CTA — always show when ERP data is hidden but we have meta (e.g., disabled state) */}
      {!showErpData && !showEmptyRegistration && (
        <div className="space-y-6 pt-4 border-t" style={{ borderColor: "var(--comp-border)" }}>
          <PortalCta meta={meta} />
        </div>
      )}

      <ConfirmDialog
        open={confirmingSubmit}
        onOpenChange={setConfirmingSubmit}
        title="Submit feedback?"
        description={`Ratings for all ${status?.pendingSubjects?.length ?? 0} pending subject${(status?.pendingSubjects?.length ?? 0) === 1 ? "" : "s"} will be submitted together using option ${optionNo}.`}
        confirmLabel="Submit feedback"
        busy={submitting}
        onConfirm={() => void handleConfirmedSubmit()}
      />
    </ErpPageShell>
  );
}