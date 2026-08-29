import { useEffect, useMemo, useState } from "react";
import { ArrowRight, DoorClosed, Info } from "lucide-react";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { SkeletonCard } from "../../components/ui";
import { EmptyState, InlineError } from "../../components/ui/Feedback";
import { Button } from "../../components/button";
import {
  getVacantRooms,
  VACANT_DAY_OPTIONS,
  VACANT_SLOT_COUNT,
  VACANT_SLOT_LABELS,
  type VacantRoomsResult,
} from "../../lib/erp/vacantRoomsApi";

// Ghost pills mirror the shape vacant rooms render as once coverage exists,
// so the empty state points at where results will appear rather than at a
// generic missing-document glyph.
function CoverageMotif() {
  return (
    <div aria-hidden="true" className="flex items-center gap-1.5">
      {Array.from({ length: 4 }, (_, index) => (
        <span
          key={index}
          className="h-7 rounded-full border border-dashed"
          style={{
            width: index === 0 ? 56 : 44,
            borderColor: "color-mix(in srgb, var(--comp-text-muted) 40%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--comp-text-muted) 5%, transparent)",
          }}
        />
      ))}
    </div>
  );
}

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

  const tryNextSlot = () => setSlot((prev) => (prev + 1) % VACANT_SLOT_COUNT);

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Internal API"
      onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
    >
      <div className="flex flex-col gap-4">
        <p
          data-page-contrast="true"
          className="page-contrast-chip inline-flex w-fit items-start gap-2 self-start rounded-lg border px-3 py-2 text-xs font-medium leading-5"
        >
          <Info size={14} className="mt-0.5 shrink-0 opacity-70" aria-hidden="true" />
          <span>
            Vacancies are inferred from timetables synced by the platform; coverage grows as more
            students use the portal.
          </span>
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
              {VACANT_SLOT_LABELS.map((label, index) => (
                <option key={index} value={index}>
                  Slot {index + 1} · {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <InlineError message={error} onRetry={() => setRefreshTrigger((prev) => prev + 1)} />
        )}

        {loading && !result ? (
          <SkeletonCard />
        ) : result ? (
          result.vacant.length === 0 ? (
            <EmptyState
              className="py-10"
              icon={
                result.knownRooms === 0 ? (
                  <CoverageMotif />
                ) : (
                  <DoorClosed size={40} strokeWidth={1.5} />
                )
              }
              title={
                result.knownRooms === 0
                  ? "Not enough coverage for this slot"
                  : "Every known room is in class"
              }
              description={
                result.knownRooms === 0
                  ? "Room vacancies are inferred from timetables synced by the platform. This day and slot don't have enough data yet; try a nearby slot or check back later."
                  : `All ${result.knownRooms} rooms with timetable coverage are occupied during this slot. Rooms free up between periods, so try an adjacent one.`
              }
              action={
                <Button type="button" variant="outline" size="sm" onClick={tryNextSlot}>
                  Try next slot
                  <ArrowRight />
                </Button>
              }
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
                      background: "color-mix(in srgb, var(--success) 8%, var(--background))",
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
