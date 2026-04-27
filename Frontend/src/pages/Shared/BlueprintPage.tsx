import { useNavigate } from "react-router-dom";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { DASHBOARD_QUICK_LINKS } from "../../config/erpBlueprints";
import {
  DataTable,
  EmptyStateCard,
  ErpPageShell,
  SectionCard,
  StatusBanner,
} from "../../components/erp/ErpPrimitives";
import { useBlueprintPageData } from "./useBlueprintPageData";

export default function BlueprintPage({ blueprint }: { blueprint: PageBlueprint }) {
  const navigate = useNavigate();
  const state = useBlueprintPageData(blueprint);

  const showEmpty = !state.isLoading && !state.error && state.sections.length === 0;

  return (
    <ErpPageShell
      title={blueprint.heading}
      source={state.source}
      updatedAt={state.updatedAt}
      isLoading={state.isLoading}
      loadingMessage={blueprint.loadingMessage || "Loading..."}
    >
      {state.error ? (
        <StatusBanner
          message={{
            id: `${blueprint.route}-error`,
            tone: "warning",
            text: state.error,
          }}
        />
      ) : null}

      {blueprint.renderer === "dashboard" ? (
        <SectionCard title="Quick Links">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {DASHBOARD_QUICK_LINKS.map((link) => (
              <button
                key={link.route}
                type="button"
                onClick={() => navigate(link.route)}
                className="dashboard-subcard rounded-lg border border-[color-mix(in_srgb,var(--comp-accent)_20%,transparent)] px-3 py-3 text-left text-sm font-medium text-[var(--comp-text-primary)] transition hover:bg-[var(--comp-surface-hover)] hover:shadow-sm"
              >
                {link.label}
              </button>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {state.statuses.map((status) => (
        <StatusBanner key={status.id} message={status} />
      ))}

      {state.sections.map((section, sectionIndex) => (
        <SectionCard key={`${section.title}-${sectionIndex}`} title={section.title}>
          {section.summary ? (
            <p className="text-sm leading-6 text-[var(--comp-text-secondary)]">{section.summary}</p>
          ) : null}

          {section.tables.map((table, tableIndex) => (
            <DataTable key={`${table.title || section.title}-${tableIndex}`} table={table} />
          ))}
        </SectionCard>
      ))}

      {showEmpty ? <EmptyStateCard message="No data sections available for this page." /> : null}
    </ErpPageShell>
  );
}
