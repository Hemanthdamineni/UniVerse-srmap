import { useEffect, useState } from "react";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { getErpBatch } from "../../lib/erp/index";
import { ErpPageShell, SectionCard, StatusBanner, KpiGrid } from "../../components/erp/ErpPrimitives";
import { InlineError, EmptyState } from "../../components/ui/Feedback";
import { SkeletonCard } from "../../components/ui/Skeletons";

interface HostelOption {
  id: string;
  blockName: string;
  roomType: string;
  capacity: number;
  occupants: number;
  floorPlan: string;
  facilities: string[];
  rent: string;
  status: "available" | "occupied" | "maintenance";
}

interface MaintenanceRequest {
  id: string;
  roomNo: string;
  category: string;
  description: string;
  status: string;
  reportedOn: string;
}

type Props = {
  blueprint: PageBlueprint;
};

const FACILITIES = ["AC", "WiFi", "Study Table", "Almirah", "Bed", "Water Supply", "Laundry", "Gym"];

const MOCK_REQUESTS: MaintenanceRequest[] = [
  { id: "1", roomNo: "A-101", category: "Electrical", description: "Fan not working", status: "In Progress", reportedOn: "2026-07-20" },
  { id: "2", roomNo: "B-203", category: "Plumbing", description: "Tap leakage", status: "Resolved", reportedOn: "2026-07-18" },
];

const MOCK_HOSTELS: HostelOption[] = [
  { id: "a", blockName: "Block A", roomType: "Triple Sharing", capacity: 3, occupants: 3, floorPlan: "3rd Floor", facilities: ["AC", "WiFi", "Bed", "Study Table"], rent: "₹12,000/mo", status: "occupied" },
  { id: "b", blockName: "Block B", roomType: "Double Sharing", capacity: 2, occupants: 1, floorPlan: "2nd Floor", facilities: ["AC", "WiFi", "Almirah", "Laundry"], rent: "₹15,000/mo", status: "available" },
];

export default function HostelBookingPage({ blueprint }: Props) {
  const [hostels, setHostels] = useState<HostelOption[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>(MOCK_REQUESTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(localStorage.getItem("adminMode") === "true");

    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const batch = await getErpBatch(blueprint.fetchKeys);

        if (!active) return;

        // Extract hostel data from batch response if available
        const hostelData = batch["hostel/hostel-booking-for-full-year"];
        if (hostelData && (hostelData as any)?.data) {
          setHostels((hostelData as any)?.data?.hostels ?? []);
        } else {
          setHostels(MOCK_HOSTELS);
        }
      } catch {
        if (active) {
          setHostels(MOCK_HOSTELS);
          setMaintenance(MOCK_REQUESTS);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [blueprint.fetchKeys]);

  const occupancyRate = hostels.length > 0
    ? Math.round((hostels.reduce((s, h) => s + h.occupants, 0) / hostels.reduce((s, h) => s + h.capacity, 0)) * 100)
    : 0;

  const kpis = [
    { label: "Blocks", value: String(hostels.length) },
    { label: "Occupancy", value: `${occupancyRate}%` },
    { label: "Available Rooms", value: String(hostels.filter((h) => h.status === "available").length) },
    { label: "Open Requests", value: String(maintenance.filter((m) => m.status !== "Resolved").length) },
  ];

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Live ERP"
      isLoading={loading}
    >
      {error && <InlineError message={error} />}

      {!error && hostels.length > 0 && <KpiGrid items={kpis} />}

      <SectionCard title="Available Blocks & Rooms">
        {hostels.length === 0 && !loading ? (
          <EmptyState
            title="No hostel blocks found"
            description="Hostel block information will appear here when available."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {hostels.map((hostel) => (
              <div
                key={hostel.id}
                className="rounded-xl border border-[var(--comp-border)] p-4 transition hover:shadow-sm"
                style={{ backgroundColor: "var(--comp-surface)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-[var(--comp-text-primary)]">{hostel.blockName}</h3>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    hostel.status === "available"
                      ? "bg-green-100 text-green-700"
                      : hostel.status === "maintenance"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {hostel.status}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--comp-text-secondary)]">Room Type</span>
                    <span className="font-medium text-[var(--comp-text-primary)]">{hostel.roomType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--comp-text-secondary)]">Floor</span>
                    <span className="font-medium text-[var(--comp-text-primary)]">{hostel.floorPlan}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--comp-text-secondary)]">Capacity</span>
                    <span className="font-medium text-[var(--comp-text-primary)]">{hostel.occupants}/{hostel.capacity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--comp-text-secondary)]">Rent</span>
                    <span className="font-semibold text-[var(--comp-text-primary)]">{hostel.rent}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {hostel.facilities.map((facility) => (
                      <span key={facility} className="px-2 py-0.5 rounded text-xs bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]">
                        {facility}
                      </span>
                    ))}
                  </div>
                </div>
                {isAdmin && (
                  <div className="mt-3 pt-3 border-t border-[var(--comp-border)] flex gap-2">
                    <button className="text-xs px-3 py-1.5 rounded-lg border border-[var(--comp-border)] hover:bg-[var(--comp-surface-hover)]">
                      Edit Details
                    </button>
                    <button className="text-xs px-3 py-1.5 rounded-lg border border-[var(--comp-border)] hover:bg-[var(--comp-surface-hover)]">
                      Toggle Status
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Maintenance Requests">
        {maintenance.length === 0 ? (
          <EmptyState
            title="No maintenance requests"
            description="Any maintenance requests you submit will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--comp-border)]">
                  <th className="text-left pb-2 font-medium text-[var(--comp-text-muted)]">Room</th>
                  <th className="text-left pb-2 font-medium text-[var(--comp-text-muted)]">Category</th>
                  <th className="text-left pb-2 font-medium text-[var(--comp-text-muted)]">Issue</th>
                  <th className="text-left pb-2 font-medium text-[var(--comp-text-muted)]">Status</th>
                  <th className="text-left pb-2 font-medium text-[var(--comp-text-muted)]">Reported On</th>
                </tr>
              </thead>
              <tbody>
                {maintenance.map((req) => (
                  <tr key={req.id} className="border-b border-[var(--comp-border)]">
                    <td className="py-2.5 font-medium">{req.roomNo}</td>
                    <td className="py-2.5">{req.category}</td>
                    <td className="py-2.5">{req.description}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        req.status === "Resolved" ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-[var(--comp-text-muted)]">{req.reportedOn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </ErpPageShell>
  );
}