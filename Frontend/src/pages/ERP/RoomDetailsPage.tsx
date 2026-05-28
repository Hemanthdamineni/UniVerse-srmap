import { useEffect, useState } from "react";
import { executePipeline, type RoomDetailsModel } from "../../lib/erpTransformers";
import { getErpBatch } from "../../lib/erpApi";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { InlineError } from "../../components/ui/InlineError";

type Props = {
  blueprint: PageBlueprint;
};

export default function RoomDetailsPage({ blueprint }: Props) {
  const [data, setData] = useState<RoomDetailsModel | null>(null);
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

        const mainKey = blueprint.fetchKeys[0];
        const rawData = (batch[mainKey] as any)?.data;

        if (!rawData) {
          throw new Error("No data found for room details.");
        }

        const pipelineResult = executePipeline("room-details", rawData);
        if (!pipelineResult.isValid || !pipelineResult.data) {
          throw new Error("Unable to parse room details.");
        }

        setData(pipelineResult.data as RoomDetailsModel);
      } catch (err: any) {
        if (active) setError(err.message || "Failed to load room details.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [blueprint, refreshTrigger]);

  const fields = data?.fields || [];

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Live ERP"
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage || "Loading room details..."}
      onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
    >
      {error && (
        <InlineError message={error} onRetry={() => setRefreshTrigger((prev) => prev + 1)} />
      )}

      {data && data.noRoom ? (
        <div className="flex min-h-40 items-center justify-center rounded-2xl px-6 text-center" style={{ border: '1px solid var(--border)', background: 'color-mix(in srgb, var(--surface) 80%, transparent)' }}>
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--comp-text-muted)' }}>Status</p>
            <p className="text-xl font-bold" style={{ color: 'var(--comp-text-primary)' }}>No hostel room assigned</p>
            <p className="text-sm" style={{ color: 'var(--comp-text-secondary)' }}>
              Room details will appear here once a hostel room is allocated.
            </p>
          </div>
        </div>
      ) : data && fields.length > 0 ? (
        <section className="dashboard-card overflow-hidden p-0">
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--comp-border)' }}>
            <h3 className="font-semibold" style={{ color: 'var(--comp-text-primary)' }}>Room Assignment</h3>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--comp-border)' }}>
            {fields.map((field, index) => (
              <div key={`${field.label}-${index}`} className="flex items-center gap-4 px-5 py-3.5">
                <span className="min-w-[180px] shrink-0 text-sm font-medium" style={{ color: 'var(--comp-text-secondary)' }}>
                  {field.label}
                </span>
                <span className="text-sm font-semibold" style={{ color: 'var(--comp-text-primary)' }}>
                  {field.value}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </ErpPageShell>
  );
}
