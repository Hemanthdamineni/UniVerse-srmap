import { useEffect, useMemo, useState } from "react";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { EmptyState, InlineError } from "../../components/ui/Feedback";
import {
  getVacantRooms,
  VACANT_DAY_OPTIONS,
  type VacantRoomsResult,
} from "../../lib/erp/vacantRoomsApi";

const SLOT_COUNT = 8;

function currentDefaults(): { day: string; slot: number } {
  // India-time defaults mirror the backend's own fallback.
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const weekday = ist.toLocaleDateString("en-US", { weekday: "long" });
  const day = (VACANT_DAY_OPTIONS as readonly string[]).includes(weekday) ? weekday : "Monday";
  const minutes = ist.getHours() * 60 + ist.getMinutes();
  const startsAt = [540, 600, 660, 720, 780, 840, 900, 960];
  const endsAt = [590, 650, 710, 770, 830, 890, 950, 1050];
  let slot = startsAt.findIndex((start, i) => minutes >= start && minutes <= endsAt[i]);
  if (slot === -1) slot = minutes < startsAt[0] ? 0 : 7;
  return { day, slot };
}

export default function VacantRoomsPage({ blueprint }: { blueprint: PageBlueprint }) {
  const defaults = useMemo(currentDefaults, []);
  const [day, setDay] = useState(defaults.day);
  const [slot, setSlot] = useState(defaults.slot);
  const [result, setResult] = useState<VacantRoomsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getVacantRooms(day, slot)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((err: unknown) => {
        if (active) setError((err as Error)?.message || "Failed to load vacant rooms.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [day, slot, refreshTrigger]);

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Internal API"
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage}
      onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--comp-text-muted)]">
          Rooms are inferred from timetables fetched by the platform — coverage grows as more
          students use the portal.
        </p>

        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--comp-text-secondary)]">
            Day
            <select
              value={day}
              onChange={(event) => setDay(event.target.value)}
              className="min-h-9 rounded-lg border px-3 py-2 text-sm font-normal"
              style={{ borderColor: "var(--comp-border)", color: "var(--comp-text-primary)" }}
            >
              {VACANT_DAY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--comp-text-secondary)]">
            Time slot
            <select
              value={slot}
              onChange={(event) => setSlot(Number.parseInt(event.target.value, 10))}
              className="min-h-9 rounded-lg border px-3 py-2 text-sm font-normal"
              style={{ borderColor: "var(--comp-border)", color: "var(--comp-text-primary)" }}
            >
              {Array.from({ length: SLOT_COUNT }, (_, index) => {
                const startHour = 9 + index;
                return (
                  <option key={index} value={index}>
                    Slot {index + 1} · {index === 7 ? "4:00–5:30 pm" : `${startHour}:00–${startHour}:50`}
                  </option>
                );
              })}
            </select>
          </label>
        </div>

        {error && (
          <InlineError message={error} onRetry={() => setRefreshTrigger((prev) => prev + 1)} />
        )}

        {result ? (
          result.vacant.length === 0 ? (
            <EmptyState
              title="No vacancy data yet"
              description="Not enough timetable data is available for this slot. Check back after more timetables have been synced."
            />
          ) : (
            <section aria-label="Vacant rooms" className="dashboard-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3" style={{ borderColor: "var(--comp-border)" }}>
                <h2 className="text-base font-semibold text-[var(--comp-text-primary)]">
                  {result.day.charAt(0).toUpperCase() + result.day.slice(1)} · Slot {result.slotIndex + 1}{" "}
                  <span className="text-sm font-normal text-[var(--comp-text-muted)]">({result.timeWindow})</span>
                </h2>
                <span className="text-xs text-[var(--comp-text-muted)]">
                  {result.vacant.length} vacant of {result.knownRooms} known rooms ·{" "}
                  {result.occupiedCount} in class
                </span>
              </div>
              <ul className="mt-3 flex flex-wrap gap-2">
                {result.vacant.map((room) => (
                  <li
                    key={room}
                    className="rounded-full border px-3 py-1 text-sm font-semibold"
                    style={{
                      borderColor: "color-mix(in srgb, var(--success) 30%, transparent)",
                      background: "color-mix(in srgb, var(--success) 8%, transparent)",
                      color: "var(--success)",
                    }}
                  >
                    {room}
                  </li>
                ))}
              </ul>
            </section>
          )
        ) : null}
      </div>
    </ErpPageShell>
  );
}
