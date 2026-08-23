import { useEffect, useState } from "react";
import { executePipeline, type FaqsModel } from "../../lib/erp/erpTransformers";
import { getErpBatch } from "../../lib/erp/index";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { EmptyState, InlineError } from "../../components/ui/Feedback";
import { ExternalLinkBtn } from "./components/ExternalLinkBtn";

type Props = {
  blueprint: PageBlueprint;
};

export default function FaqsPage({ blueprint }: Props) {
  const [data, setData] = useState<FaqsModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const batch = await getErpBatch(blueprint.fetchKeys);
        if (!active) return;

        // Merge data from all fetch keys (hostel + transport FAQs)
        const merged: Record<string, unknown> = {};
        for (const key of blueprint.fetchKeys) {
          const rawData = (batch[key] as any)?.data;
          if (rawData && typeof rawData === "object") {
            Object.assign(merged, rawData);
          }
        }

        if (Object.keys(merged).length === 0) {
          throw new Error("No FAQ content available.");
        }

        const pipelineResult = executePipeline("faqs", merged);
        if (!pipelineResult.isValid || !pipelineResult.data) {
          setData({ title: blueprint.heading, content: "", sections: [] });
          return;
        }

        setData(pipelineResult.data as FaqsModel);
      } catch (err: any) {
        if (active) setError(err.message || "Failed to load FAQs.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [blueprint, refreshTrigger]);

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Live ERP"
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage || "Loading FAQs..."}
      onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
    >
      {error && (
        <InlineError message={error} onRetry={() => setRefreshTrigger((prev) => prev + 1)} />
      )}

      {data && data.sections.length > 0 ? (
        <section className="dashboard-card divide-y divide-[var(--comp-border)] overflow-hidden p-0">
          {data.sections.map((section, index) => (
            <div key={`${section.heading}-${index}`} className="px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h2 className="card-title">{section.heading}</h2>
                {section.url ? (
                  <ExternalLinkBtn href={section.url} label={`Open ${section.heading}`} />
                ) : null}
              </div>
              {section.text ? (
                <p data-page-contrast="true" className="page-contrast-fg mt-1.5 whitespace-pre-line text-sm leading-6">
                  {section.text}
                </p>
              ) : null}
            </div>
          ))}
        </section>
      ) : data && data.sections.length === 0 && !loading && !error ? (
        <EmptyState
          title="No FAQs available"
          description="FAQ content hasn't been published yet. Check back later or visit the official ERP portal."
        />
      ) : null}
    </ErpPageShell>
  );
}
