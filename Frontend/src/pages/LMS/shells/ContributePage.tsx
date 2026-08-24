import { Link, useSearchParams } from "react-router-dom";
import { SegmentedControl } from "../../../components/ui";
import AddResourcePage from "../AddResourcePage";
import MyContributionsPage from "../me/MyContributionsPage";

type ContributeTab = "create" | "contributions";

const TAB_OPTIONS = [
  { label: "Create", value: "create" as const },
  { label: "My Contributions", value: "contributions" as const },
] as const;

const TAB_VALUES = new Set<string>(TAB_OPTIONS.map((option) => option.value));

export default function ContributePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const tab: ContributeTab = TAB_VALUES.has(String(requested)) ? (requested as ContributeTab) : "create";

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        options={TAB_OPTIONS}
        value={tab}
        onChange={(value) =>
          setSearchParams((prev) => ({ ...Object.fromEntries(prev), tab: value }), { replace: true })
        }
      />
      {tab === "create" ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Link
              to="/learn/guides/new"
              className="dashboard-card block space-y-1 p-4 no-underline transition hover:bg-[var(--comp-surface-hover)]"
            >
              <p className="text-sm font-semibold text-[var(--comp-text-primary)]">Write a guide</p>
              <p className="text-xs text-[var(--comp-text-secondary)]">
                Multi-section study guides with per-section progress tracking.
              </p>
            </Link>
            <Link
              to="/learn/roadmaps/new"
              className="dashboard-card block space-y-1 p-4 no-underline transition hover:bg-[var(--comp-surface-hover)]"
            >
              <p className="text-sm font-semibold text-[var(--comp-text-primary)]">Chart a roadmap</p>
              <p className="text-xs text-[var(--comp-text-secondary)]">
                Guided skill paths the community can follow node by node.
              </p>
            </Link>
          </div>
          <AddResourcePage />
        </div>
      ) : null}
      {tab === "contributions" ? <MyContributionsPage /> : null}
    </div>
  );
}
