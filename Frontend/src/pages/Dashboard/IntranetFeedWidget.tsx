import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Megaphone, RefreshCw } from "lucide-react";
import { getIntranetFeed, type IntranetItem } from "../../lib/intranet/intranetApi";

type WidgetState = "loading" | "error" | "empty" | "data";

const CONTENT_LABELS: Record<string, string> = {
  announcement: "Announcement",
  news: "News",
  circular: "Circular",
  notice: "Notice",
  event: "Event",
};

function contentTypeLabel(type?: string): string {
  return (type && CONTENT_LABELS[type]) || type || "Update";
}

export default function IntranetFeedWidget({ limit = 5 }: { limit?: number }) {
  const navigate = useNavigate();
  const [state, setState] = useState<WidgetState>("loading");
  const [items, setItems] = useState<IntranetItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchFeed = async () => {
    setState("loading");
    setErrorMessage(null);
    try {
      const feed = await getIntranetFeed(limit);
      setItems(feed);
      setState(feed.length === 0 ? "empty" : "data");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not load intranet updates");
      setState("error");
    }
  };

  useEffect(() => {
    void fetchFeed();
  }, [limit]);

  if (state === "loading") {
    return (
      <div className="flex h-full flex-col p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="card-title font-bold">Intranet Updates</h2>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-shimmer h-10 rounded-lg bg-[var(--comp-surface)]" />
          ))}
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex h-full flex-col p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="card-title font-bold">Intranet Updates</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] p-4 text-center">
          <AlertCircle size={24} className="text-[var(--error)]" />
          <p className="text-sm text-[var(--error)]">{errorMessage || "Could not load intranet updates"}</p>
          <button
            type="button"
            onClick={() => void fetchFeed()}
            className="flex items-center gap-2 rounded-md border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-2 text-xs font-medium text-[var(--comp-text-primary)] transition-colors hover:bg-[var(--comp-surface-hover)]"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="flex h-full flex-col p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="card-title font-bold">Intranet Updates</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
          <Megaphone size={40} className="text-[var(--comp-text-muted)] opacity-40" />
          <p className="text-sm text-[var(--comp-text-secondary)]">No intranet updates right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="card-title font-bold">Intranet Updates</h2>
      </div>

      <div className="flex-1 space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/intranet/${encodeURIComponent(item.id)}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate(`/intranet/${encodeURIComponent(item.id)}`);
              }
            }}
            className="cursor-pointer rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-3 transition-all hover:bg-[var(--comp-surface-hover)] hover:shadow-sm"
          >
            <span className="mb-1 inline-block rounded px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--accent-blue)]">
              {contentTypeLabel(item.contentType)}
            </span>
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--comp-text-primary)]">
              {item.title}
            </p>
            {item.publishedAt && (
              <p className="mt-1 text-xs text-[var(--comp-text-muted)]">
                {new Date(item.publishedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => navigate("/intranet")}
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-[var(--comp-accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        View all intranet updates
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}