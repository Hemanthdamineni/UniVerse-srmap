import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { executePipeline, type RoomDetailsModel } from "../../lib/erp/erpTransformers";
import { getErpBatch } from "../../lib/erp/index";
import { erpKeys } from "../../lib/erp/queryKeys";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell, TableCardHeader } from "../../components/erp/ErpPrimitives";
import { EmptyState, InlineError } from "../../components/ui/Feedback";

type Props = {
  blueprint: PageBlueprint;
};

export default function RoomDetailsPage({ blueprint }: Props) {
  const [data, setData] = useState<RoomDetailsModel | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const batchQuery = useQuery({
    queryKey: [...erpKeys.batch(blueprint.fetchKeys), refreshTrigger],
    queryFn: () => getErpBatch(blueprint.fetchKeys),
    staleTime: 60_000,
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!batchQuery.error) return;
    setError(batchQuery.error instanceof Error ? batchQuery.error.message : "Failed to load room details.");
  }, [batchQuery.error]);

  useEffect(() => {
    const batch = batchQuery.data;
    if (!batch) return;

    try {
      const mainKey = blueprint.fetchKeys[0];
      const rawData = (batch[mainKey] as any)?.data;

      if (!rawData) {
        throw new Error("No data found for room details.");
      }

      const pipelineResult = executePipeline("room-details", rawData);
      if (!pipelineResult.isValid || !pipelineResult.data) {
        throw new Error("Unable to parse room details.");
      }

      setError(null);
      setData(pipelineResult.data as RoomDetailsModel);
    } catch (err: any) {
      setError(err.message || "Failed to load room details.");
    }
  }, [batchQuery.data, blueprint]);

  const loading = batchQuery.isPending;

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
        <EmptyState
          title="No hostel room assigned"
          description="Room details will appear here once a hostel room is allocated to you."
        />
      ) : data && fields.length > 0 ? (
        <section className="dashboard-card overflow-hidden p-0">
          <TableCardHeader title="Room Assignment" />
          <div className="divide-y divide-[var(--comp-border)]">
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
