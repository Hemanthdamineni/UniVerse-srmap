import { useEffect, useState } from "react";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { getErpBatch, type ErpBatchPageResult } from "../../lib/erp/index";
import { readExtracted } from "../../lib/erp/shared";
import { ErpPageShell, SectionCard, StatusBanner } from "../../components/erp/ErpPrimitives";
import { InlineError, EmptyState } from "../../components/ui/Feedback";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { Bus, MapPin, Clock, User, Truck, Shield } from "lucide-react";

interface TransportRoute {
  routeId: string;
  routeName: string;
  stops: string;
  busNumber: string;
  driverName: string;
  driverContact: string;
  vehicleNumber: string;
  timings: string;
  status: string;
}

type Props = {
  blueprint: PageBlueprint;
};

function parseTransportData(rawData: unknown): TransportRoute[] {
  const extracted = readExtracted(rawData);
  if (!extracted || !extracted.records) {
    return [];
  }

  const records = extracted.records as Record<string, unknown>[];
  return records.map((r) => ({
    routeId: String(r.routeId ?? r.route_id ?? ""),
    routeName: String(r.routeName ?? r.route_name ?? ""),
    stops: String(r.stops ?? r.routeStops ?? ""),
    busNumber: String(r.busNumber ?? r.bus_number ?? ""),
    driverName: String(r.driverName ?? r.driver_name ?? ""),
    driverContact: String(r.driverContact ?? r.driver_contact ?? ""),
    vehicleNumber: String(r.vehicleNumber ?? r.vehicle_number ?? ""),
    timings: String(r.timings ?? r.schedule ?? ""),
    status: String(r.status ?? "active"),
  })).filter((r) => r.routeId || r.routeName);
}

function getColumns(isAdmin: boolean): Column<TransportRoute>[] {
  const cols: Column<TransportRoute>[] = [
    {
      header: "Route Name",
      accessor: (v) => <span className="font-medium">{v.routeName}</span>
    },
    {
      header: "Bus No.",
      accessor: (v) => <span className="font-mono">{v.busNumber}</span>
    },
    {
      header: "Stops",
      accessor: (v) => (
        <div className="max-w-xs truncate" title={v.stops}>
          <MapPin className="inline h-3 w-3 text-[var(--comp-text-muted)] mr-1" />
          {v.stops}
        </div>
      )
    },
    {
      header: "Timings",
      accessor: (v) => (
        <div className="flex items-center gap-1">
          <Clock className="inline h-3 w-3 text-[var(--comp-text-muted)]" />
          <span className="font-mono text-sm">{v.timings}</span>
        </div>
      )
    },
    {
      header: "Driver",
      accessor: (v) => (
        <div className="flex items-center gap-2">
          <User className="inline h-4 w-4 text-[var(--comp-text-muted)]" />
          <div>
            <div className="font-medium">{v.driverName}</div>
            <div className="text-xs text-[var(--comp-text-muted)]">
              {v.driverContact}
            </div>
          </div>
        </div>
      )
    },
    {
      header: "Vehicle",
      accessor: (v) => (
        <div className="flex items-center gap-1">
          <Truck className="inline h-3 w-3 text-[var(--comp-text-muted)]" />
          <span className="font-mono text-sm">{v.vehicleNumber}</span>
        </div>
      )
    },
    {
      header: "Status",
      accessor: (v) => (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          v.status === "active"
            ? "bg-green-100 text-green-800"
            : v.status === "maintenance"
            ? "bg-yellow-100 text-yellow-800"
            : "bg-gray-100 text-gray-800"
        }`}>
          <Shield className="inline h-3 w-3 mr-1" />
          {v.status}
        </span>
      )
    },
  ];

  if (isAdmin) {
    cols.push({
      header: "Actions",
      accessor: (v) => (
        <div className="flex items-center justify-center gap-2">
          <button
            className="p-1.5 rounded-lg hover:bg-[var(--comp-surface-hover)] transition"
            title="Edit route"
            aria-label={`Edit route ${v.routeName}`}
          >
            ✏️
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-[var(--comp-surface-hover)] transition"
            title="Toggle status"
            aria-label={`Toggle status for ${v.routeName}`}
          >
            ⚙️
          </button>
        </div>
      ),
    });
  }

  return cols;
}

export default function TransportRoutesPage({ blueprint }: Props) {
  const [data, setData] = useState<TransportRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check admin mode
    const adminMode = localStorage.getItem("adminMode") === "true";
    setIsAdmin(adminMode);

    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const batch = await getErpBatch(blueprint.fetchKeys);

        if (!active) return;

        let allRoutes: TransportRoute[] = [];
        for (const key of blueprint.fetchKeys) {
          const routes = parseTransportData(batch[key]);
          allRoutes = [...allRoutes, ...routes];
        }

        if (active) {
          setData(allRoutes);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load transport routes.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [blueprint.fetchKeys]);

  const columns = getColumns(isAdmin);

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Live ERP"
      isLoading={loading}
    >
      <SectionCard title="Transport Routes">
        {error && (
          <InlineError message={error} onRetry={() => window.location.reload()} />
        )}
        {!error && data.length === 0 && !loading && (
          <EmptyState
            title="No transport routes found"
            description="Transport route data will appear here when available from the ERP system."
          />
        )}
        {!error && data.length > 0 && (
          <DataTable
            data={data}
            columns={columns}
            keyExtractor={(row) => row.routeId || row.routeName}
            isLoading={loading}
            emptyTitle="No routes available"
            stickyHeader
          />
        )}
      </SectionCard>
    </ErpPageShell>
  );
}