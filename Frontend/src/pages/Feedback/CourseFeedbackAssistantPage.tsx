import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import MappedErpPage from "../ERP/MappedErpPage";
import { ErpPageShell, SectionCard, StatusBanner } from "../../components/erp/ErpPrimitives";
import type { PageBlueprint } from "../../config/erpBlueprints";
import {
  getEndSemesterFeedbackStatus,
  getRandomFeedbackTemplate,
  submitEndSemesterFeedback,
  type FeedbackStatusResponse,
  type FeedbackSubmitResponse,
  validateFeedbackComment,
} from "../../lib/studentToolsApi";

type Props = {
  blueprint: PageBlueprint;
};

export default function CourseFeedbackAssistantPage({ blueprint }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawMode = searchParams.get("mode") === "raw";

  const [status, setStatus] = useState<FeedbackStatusResponse | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<FeedbackSubmitResponse | null>(null);
  const [optionNo, setOptionNo] = useState(5);
  const [comment, setComment] = useState("");

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
    setLoading(true);
    setError(null);
    try {
      const nextStatus = await getEndSemesterFeedbackStatus();
      setStatus(nextStatus);
      setOptionNo(nextStatus.defaultOption || 5);
      await fetchTemplate(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load feedback status.");
    } finally {
      setLoading(false);
    }
  }, [fetchTemplate]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  if (rawMode) {
    return (
      <div>
        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={toggleRawMode}
            className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_20%,transparent)] bg-white px-4 py-2 text-sm font-medium text-[var(--comp-text-primary)] transition hover:bg-[var(--comp-accent)] hover:text-white"
          >
            Back To Feedback Assistant
          </button>
        </div>
        <MappedErpPage pageKey="feedback/end-semester-feedback" title="Raw ERP Feedback Page" />
      </div>
    );
  }

  const pendingSubjects = status?.pendingSubjects || [];
  const disabled = !status?.enabled;

  const handleSubmit = async () => {
    if (commentError) {
      setError(commentError);
      return;
    }

    if (!pendingSubjects.length) {
      setError("There are no pending subjects to submit right now.");
      return;
    }

    const confirmed = window.confirm(
      `Submit feedback for ${pendingSubjects.length} pending subject${pendingSubjects.length === 1 ? "" : "s"} using rating option ${optionNo}?`
    );
    if (!confirmed) return;

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
      setError(submitError instanceof Error ? submitError.message : "Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Live ERP"
      isLoading={loading}
      loadingMessage="Loading feedback assistant..."
    >
      {error ? (
        <StatusBanner
          message={{
            id: "feedback-error",
            tone: "locked",
            text: error,
          }}
        />
      ) : null}

      {disabled ? (
        <StatusBanner
          message={{
            id: "feedback-disabled",
            tone: "warning",
            text: "Automation is currently disabled. You can still open the raw ERP page and submit it manually.",
          }}
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Submission Status">
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

          <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--comp-text-primary)]">Pending Subject List</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  Review which subjects will be included before you submit the batch.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleRawMode}
                className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_20%,transparent)] px-4 py-2 text-sm font-medium text-[var(--comp-text-primary)] transition hover:bg-[var(--comp-accent)] hover:text-white"
              >
                Open Raw ERP Page
              </button>
            </div>

            {pendingSubjects.length ? (
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
            ) : (
              <p className="mt-4 text-sm text-[var(--text-secondary)]">
                {status?.alreadySubmitted
                  ? "Everything already looks submitted for this cycle."
                  : "No pending subjects were detected right now."}
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Feedback Assistant">
          <div className="space-y-4">
            <div>
              <label htmlFor="feedback-option" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                Rating Option
              </label>
              <select
                id="feedback-option"
                value={optionNo}
                onChange={(event) => setOptionNo(Number(event.target.value))}
                disabled={disabled || submitting}
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
                disabled={disabled || submitting}
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
              disabled={disabled || submitting || Boolean(commentError) || !pendingSubjects.length}
              className="w-full rounded-2xl bg-[var(--comp-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)] disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitting ? "Submitting Feedback..." : `Submit For ${pendingSubjects.length || 0} Subject${pendingSubjects.length === 1 ? "" : "s"}`}
            </button>

            <p className="text-xs leading-6 text-[var(--text-secondary)]">
              This helper only submits after you confirm. Manual captcha and your current ERP session remain the
              source of truth.
            </p>
          </div>
        </SectionCard>
      </div>

      {submitResult ? (
        <SectionCard title="Latest Batch Result">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-100 bg-[color-mix(in_srgb,var(--success)_10%,transparent)] p-4">
              <p className="text-sm text-[var(--success)]">Submitted</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--success)]">{submitResult.counts.submitted}</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] p-4">
              <p className="text-sm text-[var(--warning)]">Skipped</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--warning)]">{submitResult.counts.skipped}</p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
              <p className="text-sm text-rose-700">Failed</p>
              <p className="mt-2 text-3xl font-semibold text-rose-800">{submitResult.counts.failed}</p>
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
        </SectionCard>
      ) : null}

      <p className="text-sm text-[var(--text-secondary)]">
        Need the raw fallback instead? Use the button above, or open{" "}
        <Link className="font-semibold text-[var(--comp-text-primary)]" to={`${blueprint.route}?mode=raw`}>
          the direct ERP page
        </Link>
        .
      </p>
    </ErpPageShell>
  );
}
