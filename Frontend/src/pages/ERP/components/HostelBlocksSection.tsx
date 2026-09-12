import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getErpBatch } from "../../../lib/erp/index";
import { erpKeys } from "../../../lib/erp/queryKeys";
import { SectionCard, KpiGrid } from "../../../components/erp/ErpPrimitives";
import { InlineError, EmptyState } from "../../../components/ui/Feedback";

const FETCH_KEYS = ["hostel/hostel-booking-for-full-year"];

interface HostelOption {
  id: string;
  blockName: string;
  roomType: string;
  capacity: number | null;
  occupants: number | null;
  floorPlan: string;
  facilities?: string[];
  rent: string;
  status: "available" | "occupied" | "maintenance";
}

/**
 * Live list of hostel blocks and rooms from the ERP.
 *
 * Previously the standalone "Hostel Booking" page under Campus Tools; folded
 * into Hostel Registration. Self-contained fetch, no page shell of its own.
 */
export default function HostelBlocksSection() {
  const [hostels, setHostels] = useState<HostelOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const batchQuery = useQuery({
    queryKey: erpKeys.batch(FETCH_KEYS),
    queryFn: () => getErpBatch(FETCH_KEYS),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!batchQuery.error) return;
    setError(
      batchQuery.error instanceof Error ? batchQuery.error.message : "Failed to load hostel info.",
    );
  }, [batchQuery.error]);

  useEffect(() => {
    const batch = batchQuery.data;
    if (!batch) return;

    const result = batch["hostel/hostel-booking-for-full-year"] as
      | { success?: boolean; data?: { hostels?: HostelOption[] } }
      | undefined;

    if (!result || result.success === false) {
      setError("Hostel booking data is unavailable right now.");
      setHostels([]);
      return;
    }

    setError(null);
    setHostels(Array.isArray(result.data?.hostels) ? result.data!.hostels : []);
  }, [batchQuery.data]);

  const loading = batchQuery.isPending;

  // Occupancy is only meaningful when the ERP actually reports capacity numbers;
  // otherwise the KPI shows a dash rather than a fabricated percentage.
  const knownCapacity = hostels.reduce((sum, h) => sum + (h.capacity ?? 0), 0);
  const knownOccupants = hostels.reduce((sum, h) => sum + (h.occupants ?? 0), 0);
  const occupancyRate = knownCapacity > 0 ? Math.round((knownOccupants / knownCapacity) * 100) : null;

  const kpis = [
    { label: "Blocks", value: String(hostels.length) },
    { label: "Occupancy", value: occupancyRate === null ? "—" : `${occupancyRate}%` },
    { label: "Available Rooms", value: String(hostels.filter((h) => h.status === "available").length) },
  ];

  return (
    <SectionCard title="Available Blocks & Rooms">
      {error ? (
        <InlineError message={error} onRetry={() => void batchQuery.refetch()} />
      ) : loading ? (
        <p className="text-sm text-[var(--comp-text-muted)]">Loading hostel info…</p>
      ) : hostels.length === 0 ? (
        <EmptyState
          title="No hostel blocks found"
          description="Hostel block information will appear here once the university publishes it to the ERP."
        />
      ) : (
        <div className="space-y-4">
          <KpiGrid items={kpis} />
          <div className="grid gap-4 md:grid-cols-2">
            {hostels.map((hostel) => {
              const facilities = Array.isArray(hostel.facilities) ? hostel.facilities : [];
              const capacityText =
                hostel.capacity === null && hostel.occupants === null
                  ? "—"
                  : `${hostel.occupants ?? "—"}/${hostel.capacity ?? "—"}`;
              return (
                <div
                  key={hostel.id}
                  className="rounded-xl border border-[var(--comp-border)] p-4 transition hover:shadow-sm"
                  style={{ backgroundColor: "var(--comp-surface)" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-[var(--comp-text-primary)]">{hostel.blockName}</h3>
                    <span
                      className={`erp-status-pill ${
                        hostel.status === "available"
                          ? "erp-status-pill-success"
                          : hostel.status === "maintenance"
                          ? "erp-status-pill-warning"
                          : "erp-status-pill-info"
                      }`}
                    >
                      {hostel.status}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <InfoRow label="Room Type" value={hostel.roomType} />
                    <InfoRow label="Floor" value={hostel.floorPlan} />
                    <InfoRow label="Capacity" value={capacityText} />
                    <InfoRow label="Rent" value={hostel.rent} valueClass="font-semibold" />
                    {facilities.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {facilities.map((facility) => (
                          <span
                            key={facility}
                            className="px-2 py-0.5 rounded text-xs bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]"
                          >
                            {facility}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function InfoRow({
  label,
  value,
  valueClass = "font-medium",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--comp-text-secondary)]">{label}</span>
      <span className={`${valueClass} text-[var(--comp-text-primary)]`}>{value || "—"}</span>
    </div>
  );
}
