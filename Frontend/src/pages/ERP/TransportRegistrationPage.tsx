import { useEffect, useState } from "react";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { getErpBatch, type ErpPageResponse } from "../../lib/erp/index";
import { ErpPageShell, SectionCard } from "../../components/erp/ErpPrimitives";
import { InlineError, EmptyState } from "../../components/ui/Feedback";
import RegistrationErpPage from "./RegistrationErpPage";
import { MapPin, Clock, User, Truck, Shield } from "lucide-react";

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

const MOCK_ROUTES: TransportRoute[] = [
  {
    routeId: "R1", routeName: "Route 101 - City Center", stops: "City Ctr, Main Rd, Gate 1",
    busNumber: "B-234", driverName: "Raju", driverContact: "9876543210", vehicleNumber: "AP16TE1234", timings: "08:00 AM - 05:00 PM", status: "active"
  },
  {
    routeId: "R2", routeName: "Route 102 - Station", stops: "Station, Highway, Gate 2",
    busNumber: "B-301", driverName: "Mahesh", driverContact: "9876501234", vehicleNumber: "AP16TE5678", timings: "07:30 AM - 04:30 PM", status: "active"
  },
];

type Props = {
  blueprint: PageBlueprint;
};

export default function TransportRegistrationPage({ blueprint }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [editMode, setEditMode] = useState<string | null>(null);

  useEffect(() => {
    setIsAdmin(localStorage.getItem("adminMode") === "true");

    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        await getErpBatch(blueprint.fetchKeys);

        // Mock DB implementation for Route admin
        const customRoutes = localStorage.getItem("transport_routes_db");
        if (customRoutes) {
          try {
            setRoutes(JSON.parse(customRoutes));
          } catch {
            setRoutes(MOCK_ROUTES);
          }
        } else {
          setRoutes(MOCK_ROUTES);
          localStorage.setItem("transport_routes_db", JSON.stringify(MOCK_ROUTES));
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load transport info");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [blueprint.fetchKeys]);

  const handleUpdateStatus = (id: string) => {
    const nextRoutes = routes.map((r) => r.routeId === id ? { ...r, status: r.status === "active" ? "maintenance" : "active" } : r);
    setRoutes(nextRoutes);
    localStorage.setItem("transport_routes_db", JSON.stringify(nextRoutes));
  };

  return (
    <RegistrationErpPage
      blueprint={blueprint}
      extraContent={
        !loading && !error ? (
          <SectionCard title="Active Transport Routes">
            {isAdmin && (
              <div className="mb-4 flex items-center justify-between bg-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] p-3 rounded-lg border border-[color-mix(in_srgb,var(--comp-accent)_20%,transparent)]">
                <div>
                  <span className="text-sm font-semibold" style={{ color: "var(--comp-accent)" }}>Admin Mode Active</span>
                  <p className="text-xs text-[var(--comp-text-secondary)]">You can edit route status and manage directories directly.</p>
                </div>
                <button className="comp-btn-primary" onClick={() => alert("Open route editor modal")}>+ Create New Route</button>
              </div>
            )}

            {routes.length === 0 ? (
              <EmptyState title="No routes configured" description="Transport routes will appear here once defined by the administrator." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[var(--comp-border)]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--comp-surface-hover)] border-b border-[var(--comp-border)]">
                    <tr>
                      <th className="p-3 font-semibold text-[var(--comp-text-primary)]">Route</th>
                      <th className="p-3 font-semibold text-[var(--comp-text-primary)]">Stops</th>
                      <th className="p-3 font-semibold text-[var(--comp-text-primary)]">Vehicle</th>
                      <th className="p-3 font-semibold text-[var(--comp-text-primary)]">Driver</th>
                      <th className="p-3 font-semibold text-[var(--comp-text-primary)] text-center">Status</th>
                      {isAdmin && <th className="p-3 font-semibold text-[var(--comp-text-primary)] text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--comp-border)] bg-[var(--background)]">
                    {routes.map((route) => (
                      <tr key={route.routeId} className="hover:bg-[color-mix(in_srgb,var(--comp-surface)_50%,transparent)]">
                        <td className="p-3">
                          <p className="font-semibold text-[var(--comp-text-primary)]">{route.routeName}</p>
                          <p className="text-xs text-[var(--comp-text-muted)] flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3" /> {route.timings}</p>
                        </td>
                        <td className="p-3">
                          <p className="text-[var(--comp-text-secondary)] max-w-[200px] truncate text-xs" title={route.stops}><MapPin className="inline w-3 h-3 mr-1"/>{route.stops}</p>
                        </td>
                        <td className="p-3">
                          <p className="font-mono text-xs">{route.busNumber}</p>
                          <p className="text-[10px] text-[var(--comp-text-muted)]">{route.vehicleNumber}</p>
                        </td>
                        <td className="p-3">
                          <p className="font-medium">{route.driverName}</p>
                          <p className="text-xs text-[var(--comp-text-muted)]">{route.driverContact}</p>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            route.status === "active" ? "bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)] border border-[color-mix(in_srgb,var(--success)_30%,transparent)]" : "bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] text-[var(--warning)] border border-[color-mix(in_srgb,var(--warning)_30%,transparent)]"
                          }`}>
                            {route.status}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleUpdateStatus(route.routeId)}
                              className="text-[11px] font-semibold uppercase tracking-wide border px-2 py-1 rounded hover:bg-[var(--comp-surface)]"
                            >
                              Toggle
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        ) : null
      }
    />
  );
}