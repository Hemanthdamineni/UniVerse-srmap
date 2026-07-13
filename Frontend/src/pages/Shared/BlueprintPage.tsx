import { useNavigate } from "react-router-dom";
import type { PageBlueprint } from "../../config/erpBlueprints";
import {
  DataTable,
  EmptyStateCard,
  ErpPageShell,
  SectionCard,
  StatusBanner,
} from "../../components/erp/ErpPrimitives";
import { useBlueprintPageData } from "./useBlueprintPageData";
import DashboardQuickLinks from "./components/DashboardQuickLinks";

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

      {blueprint.renderer === "dashboard" ? <DashboardQuickLinks /> : null}

      {state.statuses.map((status) => (
        <StatusBanner key={status.id} message={status} />
      ))}

      {state.sections.map((section, sectionIndex) => (
        <SectionCard key={`${section.title}-${sectionIndex}`} title={section.title}>
          {section.summary ? (
            <p className="text-sm leading-6 text-[var(--comp-text-secondary)]">{section.summary}</p>
          ) : null}

          {/* External URL links — rendered as action buttons */}
          {section.links && section.links.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {section.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="comp-btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold no-underline"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  {link.label}
                </a>
              ))}
            </div>
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
