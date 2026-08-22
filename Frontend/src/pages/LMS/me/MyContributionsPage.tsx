import {
  useEffect,
  useState,
  Link,
  SectionCard,
  InlineError,
  RecommendationSection,
  deleteLmsResource,
  restoreLmsResource,
  getMyContributions,
  useAsyncPage,
  LmsFrame
} from "../_shared/LmsPageShared";
import type {
  LmsGuide,
  LmsResource,
  LmsRoadmap
} from "../_shared/LmsPageShared";

export function MyContributionsPage() {
  const { data, setData, loading, error } = useAsyncPage(() => getMyContributions(), []);
  const [actionError, setActionError] = useState("");

  const resources = ((data?.resources as LmsResource[]) || []);
  const guides = ((data?.guides as LmsGuide[]) || []);
  const roadmaps = ((data?.roadmaps as LmsRoadmap[]) || []);

  // Deleted resources stay visible to their owner (soft-delete semantics) — the
  // owner gets a Restore action; live resources get Edit/Delete.
  const liveResources = resources.filter((r) => !r.isDeleted);
  const deletedResources = resources.filter((r) => r.isDeleted);

  const refresh = async () => {
    try {
      const next = await getMyContributions();
      setData(next);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to refresh contributions.");
    }
  };

  useEffect(() => {
    if (actionError) {
      const timeout = setTimeout(() => setActionError(""), 6000);
      return () => clearTimeout(timeout);
    }
  }, [actionError]);

  const handleDelete = async (resource: LmsResource) => {
    if (!window.confirm(`Move "${resource.title}" to deleted? You can restore it from this page.`)) return;
    setActionError("");
    try {
      await deleteLmsResource(resource.id);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to delete this resource.");
    }
  };

  const handleRestore = async (resource: LmsResource) => {
    setActionError("");
    try {
      await restoreLmsResource(resource.id);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to restore this resource.");
    }
  };

  return (
    <LmsFrame title="My Contributions" loading={loading} error={error}>
      {actionError ? <InlineError message={actionError} /> : null}

      <SectionCard title="My Resources">
        <div className="space-y-2">
          {liveResources.length === 0 && deletedResources.length === 0 ? (
            <p className="body-text">No resources contributed yet.</p>
          ) : null}
          {liveResources.map((resource) => (
            <div key={resource.id} className="dashboard-card flex items-center justify-between gap-3 p-4">
              <Link
                to={`/resources/${resource.id}`}
                className="min-w-0 flex-1 no-underline"
              >
                <p className="truncate text-sm font-semibold text-[var(--comp-text-primary)] hover:text-[var(--info)]">
                  {resource.title}
                </p>
                <p className="mt-0.5 text-xs text-[var(--comp-text-muted)]">
                  {[resource.type, resource.subjectCode, `↑ ${resource.upvotes}`, `${resource.viewCount} views`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Link>
              <div className="flex shrink-0 gap-2">
                <Link
                  to={`/resources/add?edit=${encodeURIComponent(resource.id)}`}
                  className="rounded-full border border-[var(--comp-border)] px-3 py-1.5 text-xs font-semibold text-[var(--comp-text-primary)] no-underline"
                >
                  Edit
                </Link>
                <button
                  className="rounded-full border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--error)]"
                  onClick={() => void handleDelete(resource)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {deletedResources.length > 0 ? (
        <SectionCard title="Deleted (restorable)">
          <div className="space-y-2">
            {deletedResources.map((resource) => (
              <div key={resource.id} className="dashboard-card flex items-center justify-between gap-3 p-4 opacity-70">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--comp-text-primary)]">{resource.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--comp-text-muted)]">
                    {[resource.type, resource.subjectCode].filter(Boolean).join(" · ")}
                    {resource.deletedAt ? ` · deleted ${new Date(resource.deletedAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <button
                  className="shrink-0 rounded-full border border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--success)]"
                  onClick={() => void handleRestore(resource)}
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="My Guides">
        <div className="space-y-2">
          {guides.map((guide) => (
            <Link key={guide.id} to={`/resources/guides/${guide.id}`} className="dashboard-card block p-4 no-underline">
              <p className="text-sm font-semibold text-[var(--comp-text-primary)] hover:text-[var(--info)]">{guide.title}</p>
            </Link>
          ))}
          {guides.length === 0 ? <p className="body-text">No guides published yet.</p> : null}
        </div>
      </SectionCard>

      <SectionCard title="My Roadmaps">
        <div className="space-y-2">
          {roadmaps.map((roadmap) => (
            <Link key={roadmap.id} to={`/resources/roadmaps/${roadmap.id}`} className="dashboard-card block p-4 no-underline">
              <p className="text-sm font-semibold text-[var(--comp-text-primary)] hover:text-[var(--info)]">{roadmap.title}</p>
            </Link>
          ))}
          {roadmaps.length === 0 ? <p className="body-text">No roadmaps published yet.</p> : null}
        </div>
      </SectionCard>
    </LmsFrame>
  );
}

export default MyContributionsPage;
