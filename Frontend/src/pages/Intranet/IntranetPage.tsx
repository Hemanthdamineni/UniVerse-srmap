import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, ExternalLink, Megaphone, RefreshCw } from "lucide-react";
import PageLayout from "../Pagelayout";
import { getIntranetFeed, getIntranetItem, type IntranetItem } from "../../lib/intranet/intranetApi";

type ViewState = "loading" | "error" | "empty" | "data";

const CONTENT_LABELS: Record<string, string> = {
  announcement: "Announcement",
  news: "News",
  circular: "Circular",
  notice: "Notice",
  event: "Event",
  academic: "Academic",
  document: "Document",
};

function label(type?: string): string {
  return (type && CONTENT_LABELS[type]) || type || "Update";
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

function IntranetDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const [state, setState] = useState<ViewState>("loading");
  const [item, setItem] = useState<IntranetItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const data = await getIntranetItem(id);
      setItem(data);
      setState("data");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not load this intranet item");
      setState("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === "loading") {
    return (
      <PageLayout>
        <div className="mx-auto w-full max-w-3xl p-6">
          <div className="skeleton-shimmer h-8 w-2/3 rounded" />
          <div className="skeleton-shimmer mt-4 h-40 w-full rounded" />
        </div>
      </PageLayout>
    );
  }

  if (state === "error" || !item) {
    return (
      <PageLayout>
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 p-6 text-center">
          <AlertCircle size={28} className="text-[var(--error)]" />
          <p className="text-sm text-[var(--error)]">{errorMessage || "Could not load this intranet item"}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="flex items-center gap-2 rounded-md border border-[var(--comp-border)] px-3 py-2 text-xs font-medium"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <article className="mx-auto w-full max-w-3xl p-6">
        <button
          type="button"
          onClick={() => navigate("/intranet")}
          className="mb-4 flex items-center gap-1 text-sm font-medium text-[var(--comp-accent)]"
        >
          <ArrowLeft size={16} /> All intranet updates
        </button>
        <span className="inline-block rounded bg-[color-mix(in_srgb,var(--accent-blue)_15%,transparent)] px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent-blue)]">
          {label(item.contentType)}
        </span>
        <h1 className="mt-3 text-2xl font-bold text-[var(--comp-text-primary)]">{item.title}</h1>
        <div className="mt-1 text-xs text-[var(--comp-text-muted)]">
          {item.department && <span>{item.department} · </span>}
          {item.publishedAt && <span>{formatDate(item.publishedAt)}</span>}
        </div>
        {item.summary && (
          <p className="mt-4 text-base font-medium text-[var(--comp-text-secondary)]">{item.summary}</p>
        )}
        {item.body && (
          <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[var(--comp-text-primary)]">
            {item.body}
          </div>
        )}
        {Array.isArray(item.documentLinks) && item.documentLinks.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-[var(--comp-text-primary)]">Attachments</h2>
            <ul className="space-y-1">
              {item.documentLinks.map((doc) => (
                <li key={doc.url}>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[var(--comp-accent)] hover:underline"
                  >
                    <ExternalLink size={14} /> {doc.label || doc.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <a
          href={item.canonicalUrl || item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-1 text-xs text-[var(--comp-text-muted)] hover:underline"
        >
          <ExternalLink size={12} /> View original on the SRMAP intranet
        </a>
      </article>
    </PageLayout>
  );
}

export default function IntranetPage() {
  const params = useParams();
  if (params.id) {
    return <IntranetDetail id={params.id} />;
  }
  return <IntranetList />;
}

function IntranetList() {
  const navigate = useNavigate();
  const [state, setState] = useState<ViewState>("loading");
  const [items, setItems] = useState<IntranetItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    setErrorMessage(null);
    try {
      const feed = await getIntranetFeed(40);
      setItems(feed);
      setState(feed.length === 0 ? "empty" : "data");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not load intranet updates");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageLayout>
      <div className="mx-auto w-full max-w-3xl p-6">
        <h1 className="mb-1 text-2xl font-bold text-[var(--comp-text-primary)]">Intranet Updates</h1>
        <p className="mb-4 text-sm text-[var(--comp-text-secondary)]">
          Official announcements, news, and events from the SRMAP intranet.
        </p>

        {state === "loading" && (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton-shimmer h-16 rounded-lg bg-[var(--comp-surface)]" />
            ))}
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-[color-mix(in_srgb,var(--error)_30%,transparent)] p-6 text-center">
            <AlertCircle size={24} className="text-[var(--error)]" />
            <p className="text-sm text-[var(--error)]">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="flex items-center gap-2 rounded-md border border-[var(--comp-border)] px-3 py-2 text-xs font-medium"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {state === "empty" && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Megaphone size={40} className="text-[var(--comp-text-muted)] opacity-40" />
            <p className="text-sm text-[var(--comp-text-secondary)]">No intranet updates right now.</p>
          </div>
        )}

        {state === "data" && (
          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/intranet/${encodeURIComponent(item.id)}`)}
                className="block w-full rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4 text-left transition-all hover:bg-[var(--comp-surface-hover)] hover:shadow-sm"
              >
                <span className="mb-1 inline-block rounded px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--accent-blue)]">
                  {label(item.contentType)}
                </span>
                <p className="text-sm font-semibold text-[var(--comp-text-primary)]">{item.title}</p>
                {item.summary && (
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--comp-text-secondary)]">{item.summary}</p>
                )}
                {(item.publishedAt || item.department) && (
                  <p className="mt-1 text-xs text-[var(--comp-text-muted)]">
                    {item.department && <span>{item.department} · </span>}
                    {formatDate(item.publishedAt)}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}