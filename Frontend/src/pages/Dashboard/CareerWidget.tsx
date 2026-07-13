import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Clock, AlertCircle, RefreshCw, ArrowRight } from "lucide-react";
import { listOpportunities, listApplications, type CareerOpportunity } from "../../lib/career/careerApi";

function formatTimeUntil(deadline?: string): string {
  if (!deadline) return "No deadline";
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days === 1) return "1 day left";
  if (days < 7) return `${days} days left`;
  return `${Math.floor(days / 7)} weeks left`;
}

export default function CareerWidget() {
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<CareerOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applicationCount, setApplicationCount] = useState(0);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ops, apps] = await Promise.all([
        listOpportunities({ type: "all", deadlineSoon: "true", limit: "3" }),
        listApplications(),
      ]);
      setOpportunities(ops.items || []);
      setApplicationCount((apps as { items?: { length: number } }).items?.length || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full flex-col p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="card-title font-bold">Career Portal</h2>
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 bg-[var(--status-pending-bg)] text-[var(--status-pending-text)] rounded-full border border-[var(--status-pending-border)]">
            <Briefcase size={12} />
            Loading
          </span>
        </div>
        <div className="space-y-2 animate-pulse">
          <div className="h-16 rounded-lg bg-[var(--comp-surface)]" />
          <div className="h-16 rounded-lg bg-[var(--comp-surface)]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="card-title font-bold">Career Portal</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <AlertCircle size={24} className="text-[var(--error)]" />
          <p className="text-sm text-[var(--comp-text-secondary)]">{error}</p>
          <button
            onClick={loadData}
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-1.5 text-xs font-medium"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div className="flex h-full flex-col p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="card-title font-bold">Career Portal</h2>
          {applicationCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 bg-[var(--status-success-bg)] text-[var(--status-success-text)] rounded-full border border-[var(--status-success-border)]">
              {applicationCount} application{applicationCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Briefcase size={32} className="text-[var(--comp-text-muted)] opacity-40 mb-2" />
          <p className="text-sm text-[var(--comp-text-secondary)]">
            No urgent opportunities
          </p>
        </div>
        <button
          onClick={() => navigate("/career")}
          type="button"
          className="mt-3 w-full rounded-lg border-2 border-[var(--comp-accent)] text-[var(--comp-accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--comp-accent)] hover:text-white transition-colors flex items-center justify-center gap-1"
        >
          Go to Career Portal
          <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="card-title font-bold">Career Portal</h2>
        <div className="flex items-center gap-2">
          {applicationCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 bg-[var(--status-success-bg)] text-[var(--status-success-text)] rounded-full border border-[var(--status-success-border)]">
              {applicationCount} application{applicationCount !== 1 ? "s" : ""}
            </span>
          )}
          <span className="text-xs font-semibold px-2 py-1 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] rounded-full border border-[var(--accent-blue)]/20">
            {opportunities.length} expiring soon
          </span>
        </div>
      </div>

      <div className="space-y-2 flex-1">
        {opportunities.slice(0, 2).map((op) => (
          <div
            key={op.id}
            onClick={() => navigate(`/career/opportunities/${op.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate(`/career/opportunities/${op.id}`);
              }
            }}
            className="cursor-pointer rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-3 transition-all hover:bg-[var(--comp-surface-hover)] hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--comp-text-primary)]">
                  {op.title}
                </p>
                <p className="text-xs text-[var(--comp-text-secondary)]">
                  {op.company || op.organizer || "Unknown company"}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: `color-mix(in srgb, var(--deadline-urgent) 15%, transparent)`,
                  color: "var(--deadline-urgent)",
                }}
              >
                <Clock size={10} />
                {formatTimeUntil(op.deadline)}
              </span>
              <span className="text-[10px] uppercase font-semibold text-[var(--comp-text-muted)]">
                {op.type}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate("/career")}
        type="button"
        className="mt-3 w-full rounded-lg border-2 border-[var(--comp-accent)] text-[var(--comp-accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--comp-accent)] hover:text-white transition-colors flex items-center justify-center gap-1"
      >
        Go to Career Portal
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
