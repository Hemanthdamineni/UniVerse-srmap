import { useCallback, useEffect, useMemo, useState } from "react";
import { ErpPageShell, KpiGrid } from "../../components/erp/ErpPrimitives";
import { ErrorMessage } from "../../components/competition/ErrorMessage";
import {
  getCompanionAnalyticsReport,
  type CompanionAnalyticsReport,
} from "../../lib/career/companionAnalyticsApi";
import { Select } from "../../components/select";

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDate(value?: string | null) {
  if (!value) return "No data";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function labelize(value: string) {
  return value
    .split("_")
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");
}

export default function AdminCompanionAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<CompanionAnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCompanionAnalyticsReport({ days, limit: 12 });
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load companion analytics.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const maxCategory = useMemo(
    () => Math.max(1, ...(report?.byCategory || []).map((item) => item.count)),
    [report?.byCategory]
  );

  return (
    <ErpPageShell
      title="Companion Analytics"
      source="Internal API"
      isLoading={loading}
      loadingMessage="Loading companion analytics..."
      onRefresh={loadReport}
      headerActions={
        <Select
          value={String(days)}
          onChange={(event) => setDays(Number(event.target.value))}
          aria-label="Analytics window"
          className="h-10 min-w-36"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </Select>
      }
    >
      {/* Subtitle */}
      <p className="comp-body max-w-[68ch]">Adoption, recommendation, and conversion signals from LMS, Career, Events, and public profile workflows.</p>

      {error ? <ErrorMessage message={error} onRetry={loadReport} /> : null}

      {report ? (
        <>
          <KpiGrid
            items={[
              {
                label: "Events",
                value: report.totals.totalEvents.toLocaleString("en-IN"),
                subtitle: `Since ${formatDate(report.totals.firstEventAt)}`,
              },
              {
                label: "Actors",
                value: report.totals.activeActors.toLocaleString("en-IN"),
                subtitle: `${report.totals.sessions.toLocaleString("en-IN")} tracked sessions`,
              },
              {
                label: "Recommendation CTR",
                value: percent(report.recommendationCtr.rate),
                subtitle: `${report.recommendationCtr.clicks} clicks from ${report.recommendationCtr.impressions} impressions`,
              },
              {
                label: "Signals",
                value: report.topEvents.length.toLocaleString("en-IN"),
                subtitle: `Generated ${formatDate(report.generatedAt)}`,
              },
            ]}
          />

        <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--comp-text-primary)]">Category Mix</h2>
              <p className="body-text text-sm">Which companion loops are producing usage signals.</p>
            </div>
            <div className="space-y-3">
              {report.byCategory.length ? report.byCategory.map((item) => (
                <div key={item.category} className="rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-3">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-[var(--comp-text-primary)]">{labelize(item.category)}</span>
                    <span className="text-[var(--comp-text-secondary)]">{item.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--comp-surface-hover)]">
                    <div
                      className="h-full rounded-full bg-[var(--comp-accent)]"
                      style={{ width: `${Math.max(4, (item.count / maxCategory) * 100)}%` }}
                    />
                  </div>
                </div>
              )) : (
                <p className="body-text rounded-lg border border-dashed border-[var(--comp-border)] p-4 text-sm">
                  Analytics will appear after students use companion workflows.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--comp-text-primary)]">Conversion Events</h2>
              <p className="body-text text-sm">Core milestones tied to adoption, retention, and ecosystem effects.</p>
            </div>
            <div className="erp-table-shell">
              <div className="max-h-[420px] overflow-auto">
                <table className="erp-table text-left">
                  <thead className="erp-table-head">
                    <tr>
                      <th className="erp-table-head-cell label-text">Event</th>
                      <th className="erp-table-align-right erp-table-head-cell label-text">Count</th>
                    </tr>
                  </thead>
                  <tbody className="erp-table-body">
                    {report.funnel.length ? report.funnel.map((item) => (
                      <tr key={item.eventName} className="erp-table-row">
                        <td className="erp-table-cell font-medium text-[var(--comp-text-primary)]">{labelize(item.eventName)}</td>
                        <td className="erp-table-align-right erp-table-cell text-[var(--comp-text-secondary)]">{item.count}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td className="erp-table-cell text-[var(--comp-text-secondary)]" colSpan={2}>No conversion events yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--comp-text-primary)]">Top Events</h2>
            <p className="body-text text-sm">Most frequent product signals in the selected window.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {report.topEvents.map((item) => (
              <article key={item.eventName} className="rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--comp-text-primary)]">{labelize(item.eventName)}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--comp-text-muted)]">{item.category}</p>
                  </div>
                  <span className="rounded-full border border-[var(--comp-border)] px-2 py-0.5 text-xs text-[var(--comp-text-secondary)]">
                    {item.actors} actors
                  </span>
                </div>
                <p className="mt-3 text-xl font-semibold text-[var(--comp-text-primary)]">{item.count}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--comp-text-primary)]">Recent Signals</h2>
            <p className="body-text text-sm">Latest events captured by the internal analytics sink.</p>
          </div>
          <div className="erp-table-shell">
            <div className="max-h-[420px] overflow-auto">
              <table className="erp-table text-left">
                <thead className="erp-table-head">
                  <tr>
                    <th className="erp-table-head-cell label-text">Signal</th>
                    <th className="erp-table-head-cell label-text">Route</th>
                    <th className="erp-table-head-cell label-text">Actor</th>
                    <th className="erp-table-align-right erp-table-head-cell label-text">Time</th>
                  </tr>
                </thead>
                <tbody className="erp-table-body">
                  {report.recent.length ? report.recent.map((item) => (
                    <tr key={item.id} className="erp-table-row">
                      <td className="erp-table-cell font-medium text-[var(--comp-text-primary)]">{labelize(item.eventName)}</td>
                      <td className="erp-table-cell text-[var(--comp-text-secondary)]">{item.route || "Unknown"}</td>
                      <td className="erp-table-cell text-[var(--comp-text-secondary)]">{item.userId || item.role || "Anonymous"}</td>
                      <td className="erp-table-align-right erp-table-cell text-[var(--comp-text-secondary)]">{formatDate(item.occurredAt)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td className="erp-table-cell text-[var(--comp-text-secondary)]" colSpan={4}>No recent signals yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </>
    ) : null}
  </ErpPageShell>
  );
}
