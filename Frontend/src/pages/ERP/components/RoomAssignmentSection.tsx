import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { executePipeline, type RoomDetailsModel } from "../../../lib/erp/erpTransformers";
import { getErpBatch } from "../../../lib/erp/index";
import { erpKeys } from "../../../lib/erp/queryKeys";
import { SectionCard } from "../../../components/erp/ErpPrimitives";
import { EmptyState, InlineError } from "../../../components/ui/Feedback";

const FETCH_KEYS = ["hostel/room-details"];

/**
 * The student's allocated hostel room, pulled live from the ERP.
 *
 * Previously a standalone "Rooms Details" page under Campus Tools; folded into
 * Hostel Registration so every hostel task lives on one screen. Self-contained
 * (owns its own fetch) and chrome-free — the parent page shell owns the H1 and
 * refresh control.
 */
export default function RoomAssignmentSection() {
  const [data, setData] = useState<RoomDetailsModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const batchQuery = useQuery({
    queryKey: erpKeys.batch(FETCH_KEYS),
    queryFn: () => getErpBatch(FETCH_KEYS),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!batchQuery.error) return;
    setError(
      batchQuery.error instanceof Error ? batchQuery.error.message : "Failed to load room details.",
    );
  }, [batchQuery.error]);

  useEffect(() => {
    const batch = batchQuery.data;
    if (!batch) return;

    try {
      const raw = (batch["hostel/room-details"] as { data?: unknown } | undefined)?.data;
      if (!raw) throw new Error("No data found for room details.");

      const result = executePipeline("room-details", raw);
      if (!result.isValid || !result.data) throw new Error("Unable to parse room details.");

      setError(null);
      setData(result.data as RoomDetailsModel);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load room details.");
    }
  }, [batchQuery.data]);

  const fields = data?.fields ?? [];

  return (
    <SectionCard title="My Room Assignment">
      {error ? (
        <InlineError message={error} onRetry={() => void batchQuery.refetch()} />
      ) : batchQuery.isPending ? (
        <p className="text-sm text-[var(--comp-text-muted)]">Loading room details…</p>
      ) : data?.noRoom ? (
        <EmptyState
          title="No hostel room assigned"
          description="Room details will appear here once a hostel room is allocated to you."
        />
      ) : fields.length > 0 ? (
        <div
          className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-[var(--comp-border)] p-4 sm:grid-cols-3"
          style={{ backgroundColor: "var(--comp-surface)" }}
        >
          {fields.map((field, index) => (
            <div key={`${field.label}-${index}`} className="min-w-0">
              <p
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--comp-text-muted)" }}
              >
                {field.label}
              </p>
              <p className="mt-1 truncate text-sm font-semibold" style={{ color: "var(--comp-text-primary)" }}>
                {field.value || "—"}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </SectionCard>
  );
}
