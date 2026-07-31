import { useEffect, useState } from "react";
import { executePipeline, type FaqsModel } from "../../lib/erp/erpTransformers";
import { getErpBatch } from "../../lib/erp/index";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell, SectionCard } from "../../components/erp/ErpPrimitives";
import { EmptyState, InlineError } from "../../components/ui/Feedback";

type Props = {
  blueprint: PageBlueprint;
};

function ExternalLinkBtn({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold no-underline transition"
      style={{
        background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
        color: 'var(--accent)',
        border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 20%, transparent)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 12%, transparent)')}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
      {label}
    </a>
  );
}

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
        <div className="space-y-4">
          {data.sections.map((section, index) => (
            <SectionCard key={`${section.heading}-${index}`} title={section.heading}>
              {section.url ? (
                <ExternalLinkBtn href={section.url} label={`Open ${section.heading}`} />
              ) : null}
              {section.text ? (
                <p data-page-contrast="true" className="page-contrast-fg whitespace-pre-line text-sm leading-7">
                  {section.text}
                </p>
              ) : null}
            </SectionCard>
          ))}
        </div>
      ) : data && data.sections.length === 0 && !loading && !error ? (
        <EmptyState
          title="No FAQs available"
          description="FAQ content hasn't been published yet. Check back later or visit the official ERP portal."
        />
      ) : null}
    </ErpPageShell>
  );
}
