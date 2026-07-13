import { SectionCard } from "../../../components/erp/ErpPrimitives";
import type { ResourceRecommendation } from "../../../lib/lms/index";
import type { AdminLearningResourceItem, AdminQueueHandlers, AdminQueueState } from "./types";

type AdminResourceQueueProps = AdminQueueState &
  AdminQueueHandlers & {
    adminItems: AdminLearningResourceItem[];
  };

type RecommendationQueueProps = {
  recommendations: ResourceRecommendation[];
  onReview: (contentId: string, status: "approved" | "rejected") => void;
};

export function AdminResourceQueue({
  adminItems,
  selectedAdminIds,
  bulkAction,
  bulkPreview,
  historyOpenId,
  historyItems,
  onToggleSelection,
  onBulkActionChange,
  onBulkPreview,
  onBulkExecute,
  onEdit,
  onToggleVisibility,
  onLifecycleAction,
  onHistory,
  onDelete,
}: AdminResourceQueueProps) {
  if (!adminItems.length) return null;

  return (
    <SectionCard title="Admin Resource Queue">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="admin-bulk-action" className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              Bulk action
            </label>
            <select
              id="admin-bulk-action"
              value={bulkAction}
              onChange={(event) => onBulkActionChange(event.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              <option value="publish">Publish</option>
              <option value="unpublish">Unpublish</option>
              <option value="archive">Archive</option>
              <option value="restore">Restore</option>
              <option value="delete">Delete</option>
            </select>
          </div>
          <button
            type="button"
            onClick={onBulkPreview}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-primary)] transition hover:bg-[var(--comp-surface-hover)]"
          >
            Preview Bulk Action
          </button>
          <button
            type="button"
            disabled={!bulkPreview?.valid}
            onClick={onBulkExecute}
            className="rounded-lg bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)] disabled:opacity-50"
          >
            Execute Preview
          </button>
          <p className="text-sm text-[var(--text-secondary)]">{selectedAdminIds.length} selected</p>
        </div>
        {bulkPreview ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {bulkPreview.items.map((item) => (
              <div key={item.id} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--comp-text-primary)]">{item.title || item.id}</span>{" "}
                {item.currentState} to {item.nextState} | {item.valid ? "valid" : item.reason || "invalid"}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        {adminItems.map((item) => (
          <AdminResourceQueueItem
            key={item.id}
            item={item}
            selected={selectedAdminIds.includes(item.id)}
            historyOpenId={historyOpenId}
            historyItems={historyItems}
            onToggleSelection={onToggleSelection}
            onEdit={onEdit}
            onToggleVisibility={onToggleVisibility}
            onLifecycleAction={onLifecycleAction}
            onHistory={onHistory}
            onDelete={onDelete}
          />
        ))}
      </div>
    </SectionCard>
  );
}

function AdminResourceQueueItem({
  item,
  selected,
  historyOpenId,
  historyItems,
  onToggleSelection,
  onEdit,
  onToggleVisibility,
  onLifecycleAction,
  onHistory,
  onDelete,
}: {
  item: AdminLearningResourceItem;
  selected: boolean;
  historyOpenId: string;
  historyItems: AdminResourceQueueProps["historyItems"];
  onToggleSelection: AdminQueueHandlers["onToggleSelection"];
  onEdit: AdminQueueHandlers["onEdit"];
  onToggleVisibility: AdminQueueHandlers["onToggleVisibility"];
  onLifecycleAction: AdminQueueHandlers["onLifecycleAction"];
  onHistory: AdminQueueHandlers["onHistory"];
  onDelete: AdminQueueHandlers["onDelete"];
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <input
            type="checkbox"
            aria-label={`Select ${item.title}`}
            checked={selected}
            onChange={() => onToggleSelection(item.id)}
            className="mt-1 h-4 w-4 rounded border-[var(--border)]"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">{item.title}</h3>
              <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
                {item.lifecycleState || "published"}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.description}</p>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              Group: {String(item.metadata?.resourceGroup || "links")} | Visibility:{" "}
              {String(item.metadata?.visibility || "visible")} | Version {item.version || 1} | Last actor{" "}
              {item.lastActor || "system"}
            </p>
          </div>
        </div>
        <AdminItemActions
          item={item}
          onEdit={onEdit}
          onToggleVisibility={onToggleVisibility}
          onLifecycleAction={onLifecycleAction}
          onHistory={onHistory}
          onDelete={onDelete}
        />
      </div>
      {historyOpenId === item.id ? <HistoryPanel historyItems={historyItems} /> : null}
    </div>
  );
}

function AdminItemActions({
  item,
  onEdit,
  onToggleVisibility,
  onLifecycleAction,
  onHistory,
  onDelete,
}: {
  item: AdminLearningResourceItem;
  onEdit: AdminQueueHandlers["onEdit"];
  onToggleVisibility: AdminQueueHandlers["onToggleVisibility"];
  onLifecycleAction: AdminQueueHandlers["onLifecycleAction"];
  onHistory: AdminQueueHandlers["onHistory"];
  onDelete: AdminQueueHandlers["onDelete"];
}) {
  const hidden = String(item.metadata?.visibility || "visible") === "hidden";

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onEdit(item)}
        className="rounded-full border border-[color-mix(in_srgb,var(--info)_30%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--info)] transition hover:bg-[color-mix(in_srgb,var(--info)_10%,transparent)]"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={() => onToggleVisibility(item)}
        className="rounded-full border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--warning)] transition hover:bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]"
      >
        {hidden ? "Unhide" : "Hide"}
      </button>
      <button
        type="button"
        onClick={() => onLifecycleAction(item.id, "publish")}
        className="rounded-full border border-[color-mix(in_srgb,var(--success)_30%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--success)] transition hover:bg-[color-mix(in_srgb,var(--success)_10%,transparent)]"
      >
        Publish
      </button>
      <button
        type="button"
        onClick={() => onLifecycleAction(item.id, "unpublish")}
        className="rounded-full border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--warning)] transition hover:bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]"
      >
        Unpublish
      </button>
      {["archive", "restore"].map((action) => (
        <button
          key={action}
          type="button"
          onClick={() => onLifecycleAction(item.id, action)}
          className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--comp-surface-hover)]"
        >
          {action[0].toUpperCase() + action.slice(1)}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onHistory(item.id)}
        className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--comp-text-primary)] transition hover:bg-[var(--comp-surface-hover)]"
      >
        History
      </button>
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        className="rounded-full border border-[color-mix(in_srgb,var(--error)_30%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--error)] transition hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
      >
        Delete
      </button>
    </div>
  );
}

function HistoryPanel({ historyItems }: { historyItems: AdminResourceQueueProps["historyItems"] }) {
  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--comp-surface)] p-3">
      <h4 className="text-sm font-semibold text-[var(--comp-text-primary)]">Change history and diff</h4>
      {historyItems.length ? (
        <div className="mt-2 space-y-2">
          {historyItems.slice(0, 4).map((entry) => (
            <div key={entry.id} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs">
              <div className="font-semibold text-[var(--comp-text-primary)]">
                {entry.action} by {entry.actorId}
              </div>
              <div className="text-[var(--text-secondary)]">{entry.reason || "No reason recorded."}</div>
              <div className="mt-1 text-[var(--text-secondary)]">
                {Object.keys(entry.diff || {}).join(", ") || "No field diff recorded"}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-[var(--text-secondary)]">No audit entries found.</p>
      )}
    </div>
  );
}

export function RecommendationQueue({ recommendations, onReview }: RecommendationQueueProps) {
  return (
    <SectionCard title="Resource Recommendation Queue">
      {recommendations.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No recommendations yet.</p>
      ) : (
        <div className="space-y-3">
          {recommendations.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[var(--border)] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">{item.title}</h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.description}</p>
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">
                    Status: {String(item.metadata?.status || "pending")} | Suggested by{" "}
                    {String(item.metadata?.recommenderName || "student")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onReview(item.id, "approved")}
                    className="rounded-full border border-[color-mix(in_srgb,var(--success)_30%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--success)] transition hover:bg-[color-mix(in_srgb,var(--success)_10%,transparent)]"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => onReview(item.id, "rejected")}
                    className="rounded-full border border-[color-mix(in_srgb,var(--error)_30%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--error)] transition hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
