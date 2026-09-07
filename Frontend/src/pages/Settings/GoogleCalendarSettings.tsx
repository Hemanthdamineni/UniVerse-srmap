/**
 * GoogleCalendarSettings.tsx — connect / sync / disconnect the Google Calendar
 * integration (Batch B10). Rendered inside the Settings page. Shows an
 * "unavailable" state when the server has no OAuth client configured.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { SectionCard } from "../../components/erp/ErpPrimitives";
import {
  getGoogleCalendarStatus,
  getGoogleConnectUrl,
  syncGoogleCalendar,
  disconnectGoogleCalendar,
  getClassroomStatus,
} from "../../lib/core/googleCalendar";
import { isStaticPrototype } from "../../lib/core/prototype";
import { hasSessionAuth } from "../../lib/core/session";

export default function GoogleCalendarSettings() {
  const queryClient = useQueryClient();
  const enabled = hasSessionAuth() && !isStaticPrototype();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState("");

  const q = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: getGoogleCalendarStatus,
    enabled,
    retry: 1,
  });
  const classroom = useQuery({
    queryKey: ["google-classroom-status"],
    queryFn: getClassroomStatus,
    enabled,
    retry: 1,
  });

  // Surface the outcome of an OAuth round-trip (callback redirects here).
  useEffect(() => {
    const g = searchParams.get("google");
    if (!g) return;
    setStatus(g === "connected" ? "Google Calendar connected." : "Couldn't connect to Google — try again.");
    setSearchParams(
      (prev) => {
        prev.delete("google");
        return prev;
      },
      { replace: true },
    );
    queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] });
  }, [searchParams, setSearchParams, queryClient]);

  const connect = useMutation({
    mutationFn: getGoogleConnectUrl,
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: () => setStatus("Couldn't start the Google connection."),
  });

  const sync = useMutation({
    mutationFn: syncGoogleCalendar,
    onSuccess: (r) => {
      const tt = r.timetable?.upserted ?? 0;
      const dl = r.deadlines?.upserted ?? 0;
      setStatus(`Synced ${tt} timetable event${tt === 1 ? "" : "s"} and ${dl} deadline${dl === 1 ? "" : "s"}.`);
      queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] });
    },
    onError: () => setStatus("Sync failed — reconnect if this keeps happening."),
  });

  const disconnect = useMutation({
    mutationFn: disconnectGoogleCalendar,
    onSuccess: () => {
      setStatus("Disconnected. The synced calendar and its events were removed.");
      queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] });
    },
  });

  if (!enabled) {
    return (
      <SectionCard title="Google Calendar">
        <p className="comp-body text-sm">Sign in to the live app to connect Google Calendar.</p>
      </SectionCard>
    );
  }

  const s = q.data;

  return (
    <SectionCard title="Google Calendar">
      <p className="comp-body mb-4 text-sm">
        Push your timetable (as weekly recurring events) and saved-opportunity deadlines into a
        dedicated "University ERP" calendar. One-way — we only touch events we created.
      </p>

      {q.isPending ? (
        <p className="text-sm text-[var(--comp-text-muted)]">Checking…</p>
      ) : !s?.available ? (
        <p className="text-sm text-[var(--comp-text-muted)]">
          Not available on this server yet — no Google OAuth client is configured.
        </p>
      ) : s.connected ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--comp-text-primary)]">
            Connected · {s.syncedCount ?? 0} event{(s.syncedCount ?? 0) === 1 ? "" : "s"} synced
            {s.lastSyncAt ? ` · last sync ${new Date(s.lastSyncAt).toLocaleString("en-IN")}` : ""}
          </p>
          {s.lastSyncStatus && s.lastSyncStatus.startsWith("error") && (
            <p className="text-xs text-[var(--status-live-text)]">{s.lastSyncStatus}</p>
          )}
          <div className="flex gap-2">
            <button type="button" className="comp-btn-primary" disabled={sync.isPending} onClick={() => sync.mutate()}>
              {sync.isPending ? "Syncing…" : "Sync now"}
            </button>
            <button type="button" className="comp-btn-ghost" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="comp-btn-primary" disabled={connect.isPending} onClick={() => connect.mutate()}>
          {connect.isPending ? "…" : "Connect Google Calendar"}
        </button>
      )}

      {classroom.data?.available && (
        <p className="mt-3 text-xs text-[var(--comp-text-muted)]">
          {classroom.data.needsReconnect
            ? "Google Classroom is available — reconnect to grant coursework access."
            : classroom.data.connected
              ? "Google Classroom coursework is included in your Coming-up timeline."
              : "Connecting also brings your Google Classroom coursework into the deadline timeline."}
        </p>
      )}

      {status && (
        <p aria-live="polite" className="mt-3 text-sm text-[var(--comp-text-muted)]">
          {status}
        </p>
      )}
    </SectionCard>
  );
}
