import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isPlaceholderBlueprint, type PageBlueprint } from "../../config/erpBlueprints";
import {
  EmptyStateCard,
  ErpDataTable,
  ErpPageShell,
  SectionCard,
  StatusBanner,
} from "../../components/erp/ErpPrimitives";
import type { PageSkeletonVariant } from "../../components/ui";
import { useBlueprintPageData } from "./useBlueprintPageData";
import DashboardQuickLinks from "./components/DashboardQuickLinks";

const DOCUMENT_RENDERERS = new Set(["profile", "document", "announcements"]);

function loadingVariantFor(blueprint: PageBlueprint): PageSkeletonVariant {
  return DOCUMENT_RENDERERS.has(blueprint.renderer) ? "document" : "table";
}

export default function BlueprintPage({ blueprint }: { blueprint: PageBlueprint }) {
  const navigate = useNavigate();
  const [reloadToken, setReloadToken] = useState(0);
  const state = useBlueprintPageData(blueprint, reloadToken);
  const isUnavailable = isPlaceholderBlueprint(blueprint);

  const showEmpty = !isUnavailable && !state.isLoading && !state.error && state.sections.length === 0;

  return (
    <ErpPageShell
      title={blueprint.heading}
      source={state.source}
      updatedAt={state.updatedAt}
      isLoading={!isUnavailable && state.isLoading}
      loadingMessage={blueprint.loadingMessage || `Loading ${blueprint.heading.toLowerCase()}...`}
      loadingVariant={loadingVariantFor(blueprint)}
    >
      {isUnavailable ? (
        <EmptyStateCard
          title="This page is not available yet"
          message={blueprint.placeholderReason || "This ERP area is not connected in UniVerse yet."}
          action={
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="comp-btn-primary rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Back to dashboard
            </button>
          }
        />
      ) : (
        <>
          {state.error ? (
            <EmptyStateCard
              title={`Could not load ${blueprint.heading}`}
              message={state.error}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReloadToken((value) => value + 1)}
                    className="comp-btn-primary rounded-lg px-4 py-2 text-sm font-semibold"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard")}
                    className="rounded-lg border border-[var(--comp-border)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-primary)]"
                  >
                    Back to dashboard
                  </button>
                </div>
              }
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

              {/* External URL links rendered as action buttons. */}
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
                <ErpDataTable key={`${table.title || section.title}-${tableIndex}`} table={table} />
              ))}
            </SectionCard>
          ))}

          {showEmpty ? (
            <EmptyStateCard
              title="No records returned"
              message="The page loaded, but the ERP did not return any records for this account."
              action={
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="rounded-lg border border-[var(--comp-border)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-primary)]"
                >
                  Back to dashboard
                </button>
              }
            />
          ) : null}
        </>
      )}
    </ErpPageShell>
  );
}
