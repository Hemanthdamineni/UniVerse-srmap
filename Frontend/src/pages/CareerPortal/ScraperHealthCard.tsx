import { useCallback, useEffect, useState } from "react";
import { EmptyStateCard, SectionCard } from "../../components/erp/ErpPrimitives";
import { StatusBadge } from "../../components/ui";
import {
  getScraperStatus,
  triggerScraper,
  type ScraperSourceStatus,
} from "../../lib/career/careerApi";

function relativeTime(iso?: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "unknown";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const BUTTON_CLASS =
  "min-h-[36px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--comp-accent)] disabled:cursor-not-allowed disabled:opacity-50";

export function ScraperHealthCard({ headers }: { headers: HeadersInit }) {
  const [sources, setSources] = useState<ScraperSourceStatus[]>([]);
  const [supervisor, setSupervisor] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [triggering, setTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getScraperStatus(headers);
      setSources(data.sources || []);
      setSupervisor(
        data.supervisor
          ? `${data.supervisor.state}${data.supervisor.pid ? ` (pid ${data.supervisor.pid})` : ""}`
          : ""
      );
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scraper status.");
    } finally {
      setLoaded(true);
    }
  }, [headers]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleTrigger() {
    setTriggering(true);
    setTriggerMessage("");
    try {
      const result = await triggerScraper(headers);
      if (result.accepted) {
        setTriggerMessage(
          result.mode === "daemon"
            ? "Run requested — the scheduler is picking it up now."
            : `One-shot scrape started${result.pid ? ` (pid ${result.pid})` : ""}.`
        );
        // Give the pipeline a moment before refreshing run rows.
        setTimeout(() => void load(), 4000);
      } else {
        setTriggerMessage(result.reason || "Run could not be started.");
      }
    } catch (err) {
      setTriggerMessage(err instanceof Error ? err.message : "Failed to trigger scraper.");
    } finally {
      setTriggering(false);
    }
  }

  return (
    <SectionCard title="Scraper Pipeline">
      <div className="flex flex-wrap items-center gap-2">
        {supervisor ? (
          <span className="text-xs text-[var(--text-secondary)]">supervisor: {supervisor}</span>
        ) : null}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => void handleTrigger()}
            disabled={triggering}
            className={BUTTON_CLASS}
          >
            {triggering ? "Requesting…" : "Run now"}
          </button>
          <button type="button" onClick={() => void load()} disabled={triggering} className={BUTTON_CLASS}>
            Refresh
          </button>
        </div>
      </div>

      {triggerMessage ? (
        <p className="text-xs text-[var(--text-secondary)]">{triggerMessage}</p>
      ) : null}

      {!loaded ? (
        <p className="text-sm text-[var(--text-secondary)]">Loading scraper status…</p>
      ) : error ? (
        <p className="text-sm text-[color-mix(in_srgb,var(--error)_75%,var(--comp-text-primary))]">{error}</p>
      ) : sources.length === 0 ? (
        <EmptyStateCard
          title="No scrape runs yet"
          message="The pipeline has not recorded any runs. It scrapes shortly after the backend starts."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {sources.map((source) => (
            <li
              key={source.source}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5"
            >
              <span className="w-24 text-sm font-medium text-[var(--text-primary)]">{source.source}</span>
              <StatusBadge
                status={source.isBlocked ? "blocked" : source.lastRun?.status || "pending"}
                dot
              />
              <span className="text-xs text-[var(--text-secondary)]">
                last run {relativeTime(source.lastRun?.startedAt ?? null)}
                {" · "}
                success {relativeTime(source.lastSuccess)}
              </span>
              <span className="ml-auto text-xs tabular-nums text-[var(--text-secondary)]">
                {source.activeOpportunities}/{source.totalOpportunities} active
                {source.consecutiveFails > 0 ? ` · ${source.consecutiveFails} fails` : ""}
              </span>
              {source.notes ? (
                <span className="w-full truncate text-xs text-[color-mix(in_srgb,var(--error)_75%,var(--comp-text-primary))]">
                  {source.notes}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export default ScraperHealthCard;
