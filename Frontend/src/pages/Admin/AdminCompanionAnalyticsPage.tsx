import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Activity, BarChart3, MousePointerClick, RefreshCw, Users } from "lucide-react";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
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

function MetricTile({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <section className="dashboard-card p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-2 text-[var(--comp-accent)]">
          {icon}
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--comp-text-muted)]">{label}</span>
      </div>
      <p className="mt-4 text-2xl font-semibold text-[var(--comp-text-primary)]">{value}</p>
      <p className="mt-1 text-sm text-[var(--comp-text-secondary)]">{detail}</p>
    </section>
  );
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
    <ErpPageShell title="Companion Analytics" source="Internal API" isLoading={loading} loadingMessage="Loading companion analytics...">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="comp-heading-lg m-0">Companion Analytics</h1>
            <p className="comp-body mt-1 max-w-[68ch]">
              Adoption, recommendation, and conversion signals from LMS, Career, Events, and public profile workflows.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <button className="comp-btn-ghost inline-flex items-center gap-2" type="button" onClick={loadReport}>
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {error ? <ErrorMessage message={error} onRetry={loadReport} /> : null}

        {report ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricTile
                icon={<Activity size={18} />}
                label="Events"
                value={report.totals.totalEvents.toLocaleString("en-IN")}
                detail={`Since ${formatDate(report.totals.firstEventAt)}`}
              />
              <MetricTile
                icon={<Users size={18} />}
                label="Actors"
                value={report.totals.activeActors.toLocaleString("en-IN")}
                detail={`${report.totals.sessions.toLocaleString("en-IN")} tracked sessions`}
              />
              <MetricTile
                icon={<MousePointerClick size={18} />}
                label="Recommendation CTR"
                value={percent(report.recommendationCtr.rate)}
                detail={`${report.recommendationCtr.clicks} clicks from ${report.recommendationCtr.impressions} impressions`}
              />
              <MetricTile
                icon={<BarChart3 size={18} />}
                label="Signals"
                value={report.topEvents.length.toLocaleString("en-IN")}
                detail={`Generated ${formatDate(report.generatedAt)}`}
              />
            </div>

            <section className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
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
                <div className="overflow-hidden rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[var(--comp-surface-hover)] text-xs uppercase tracking-[0.12em] text-[var(--comp-text-muted)]">
                      <tr>
                        <th className="px-3 py-2">Event</th>
                        <th className="px-3 py-2 text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.funnel.length ? report.funnel.map((item) => (
                        <tr key={item.eventName} className="border-t border-[var(--comp-border)]">
                          <td className="px-3 py-2 font-medium text-[var(--comp-text-primary)]">{labelize(item.eventName)}</td>
                          <td className="px-3 py-2 text-right text-[var(--comp-text-secondary)]">{item.count}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td className="px-3 py-4 text-[var(--comp-text-secondary)]" colSpan={2}>No conversion events yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--comp-text-primary)]">Top Events</h2>
                <p className="body-text text-sm">Most frequent product signals in the selected window.</p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
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
              <div className="overflow-hidden rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--comp-surface-hover)] text-xs uppercase tracking-[0.12em] text-[var(--comp-text-muted)]">
                    <tr>
                      <th className="px-3 py-2">Signal</th>
                      <th className="px-3 py-2">Route</th>
                      <th className="px-3 py-2">Actor</th>
                      <th className="px-3 py-2 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.recent.length ? report.recent.map((item) => (
                      <tr key={item.id} className="border-t border-[var(--comp-border)]">
                        <td className="px-3 py-2 font-medium text-[var(--comp-text-primary)]">{labelize(item.eventName)}</td>
                        <td className="px-3 py-2 text-[var(--comp-text-secondary)]">{item.route || "Unknown"}</td>
                        <td className="px-3 py-2 text-[var(--comp-text-secondary)]">{item.userId || item.role || "Anonymous"}</td>
                        <td className="px-3 py-2 text-right text-[var(--comp-text-secondary)]">{formatDate(item.occurredAt)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td className="px-3 py-4 text-[var(--comp-text-secondary)]" colSpan={4}>No recent signals yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </ErpPageShell>
  );
}
