import { useEffect, useState } from "react";
import {
  EmptyStateCard,
  ErpPageShell,
  SectionCard,
  StatusBanner,
} from "../../components/erp/ErpPrimitives";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import {
  bookInterviewSlot,
  cancelInterviewBooking,
  createInterviewSlot,
  deleteInterviewSlot,
  listInterviewBookings,
  listInterviewSlots,
  type InterviewBooking,
  type InterviewSlot,
  updateInterviewSlot,
} from "../../lib/careerApi";

const INTERVIEW_TYPES = ["Technical", "HR", "Group Discussion", "Technical + HR", "Coding Round", "System Design"] as const;

const TYPE_COLORS: Record<string, string> = {
  Technical: "border-[color-mix(in_srgb,var(--info)_30%,transparent)] bg-[color-mix(in_srgb,var(--info)_10%,transparent)] text-[var(--info)]",
  HR: "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]",
  "Group Discussion": "border-purple-200 bg-purple-50 text-purple-800",
  "Technical + HR": "border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]",
  "Coding Round": "border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] text-[var(--error)]",
  "System Design": "border-cyan-200 bg-cyan-50 text-cyan-800",
};

export default function InterviewBooking({ adminMode = false }: { adminMode?: boolean }) {
  const admin = useAdminAccess();
  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  const [bookings, setBookings] = useState<InterviewBooking[]>([]);
  const [editingId, setEditingId] = useState("");
  const [banner, setBanner] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [form, setForm] = useState<{
    company: string;
    type: string;
    date: string;
    time: string;
    location: string;
    status: string;
  }>({
    company: "",
    type: INTERVIEW_TYPES[0],
    date: "",
    time: "",
    location: "",
    status: "open",
  });

  async function loadData() {
    try {
      const [slotResponse, bookingResponse] = await Promise.all([
        listInterviewSlots(adminMode && admin.unlocked ? admin.adminHeaders : undefined),
        listInterviewBookings(),
      ]);
      setSlots(slotResponse.items);
      setBookings(bookingResponse.items);
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Failed to load interview data.",
      });
    }
  }

  useEffect(() => {
    void loadData();
  }, [admin.adminHeaders, admin.unlocked, adminMode]);

  async function runAction(action: () => Promise<unknown>, successText: string) {
    setBanner(null);
    try {
      await action();
      setBanner({ tone: "success", text: successText });
      await loadData();
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Action failed.",
      });
    }
  }

  const availableSlots = slots.filter((slot) => slot.available);

  return (
    <ErpPageShell title="Interview Booking" source="Internal API">
      {banner ? <StatusBanner message={{ id: "interview-banner", tone: banner.tone, text: banner.text }} /> : null}

      {adminMode && admin.unlocked ? (
        <SectionCard title={editingId ? "Edit Interview Slot" : "Create Interview Slot"}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const payload = {
                company: form.company.trim(),
                type: form.type,
                date: form.date,
                time: form.time,
                location: form.location.trim(),
                status: form.status,
              };
              if (editingId) {
                void runAction(
                  () => updateInterviewSlot(editingId, payload, admin.adminHeaders),
                  "Interview slot updated."
                );
              } else {
                void runAction(
                  () => createInterviewSlot(payload, admin.adminHeaders),
                  "Interview slot created."
                );
              }
              setEditingId("");
              setForm({
                company: "",
                type: INTERVIEW_TYPES[0],
                date: "",
                time: "",
                location: "",
                status: "open",
              });
            }}
            className="grid gap-3 md:grid-cols-2"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Company</label>
              <input
                value={form.company}
                onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Type</label>
              <select
                value={form.type}
                onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              >
                {INTERVIEW_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Time</label>
              <input
                value={form.time}
                onChange={(event) => setForm((prev) => ({ ...prev, time: event.target.value }))}
                placeholder="10:00 AM - 10:30 AM"
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Location</label>
              <input
                value={form.location}
                onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Status</label>
              <select
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-full bg-[var(--comp-accent)] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)]"
              >
                {editingId ? "Update Slot" : "Create Slot"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId("");
                    setForm({
                      company: "",
                      type: INTERVIEW_TYPES[0],
                      date: "",
                      time: "",
                      location: "",
                      status: "open",
                    });
                  }}
                  className="rounded-full border border-[var(--border)] px-6 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition hover:border-[var(--comp-accent)] hover:text-[var(--comp-text-primary)]"
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard title="My Bookings">
        {bookings.length === 0 ? (
          <EmptyStateCard message="No interviews booked yet. Browse open slots below to reserve one." />
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => (
              <div key={booking.id} className="rounded-2xl border border-[var(--border)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">{booking.id}</span>
                      <span className="rounded-full border border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] px-2.5 py-0.5 text-xs font-bold text-[var(--success)]">
                        {booking.status}
                      </span>
                    </div>
                    <h3 className="mt-1 text-base font-semibold text-[var(--comp-text-primary)]">
                      {booking.slot?.company || "Interview Slot"}
                    </h3>
                    <div className="mt-1 grid gap-1 text-xs text-[var(--text-secondary)] sm:grid-cols-3">
                      <div>{booking.slot?.date}</div>
                      <div>{booking.slot?.time}</div>
                      <div>{booking.slot?.type}</div>
                    </div>
                  </div>
                  {booking.status !== "cancelled" ? (
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(
                          () => cancelInterviewBooking(booking.id),
                          "Interview booking cancelled."
                        )
                      }
                      className="rounded-full border border-[color-mix(in_srgb,var(--error)_30%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--error)] transition hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title={`Available Slots (${availableSlots.length})`}>
        {availableSlots.length === 0 ? (
          <EmptyStateCard message="No open slots right now. Check again later or ask the career team for more schedules." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {availableSlots.map((slot) => (
              <div key={slot.id} className="dashboard-card flex flex-col justify-between p-4 md:p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-[var(--comp-text-primary)]">{slot.company}</span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                        TYPE_COLORS[slot.type] || "border-[var(--comp-border)] bg-[var(--comp-surface-hover)] text-[var(--comp-text-secondary)]"
                      }`}
                    >
                      {slot.type}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-[var(--text-secondary)]">
                    <div>{slot.date}</div>
                    <div>{slot.time}</div>
                    <div>{slot.location || "Location TBA"}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void runAction(() => bookInterviewSlot(slot.id), "Interview slot booked.")}
                    className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)]"
                  >
                    Book Slot
                  </button>
                  {adminMode && admin.unlocked ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(slot.id);
                          setForm({
                            company: slot.company,
                            type: slot.type,
                            date: slot.date,
                            time: slot.time,
                            location: slot.location,
                            status: slot.status,
                          });
                        }}
                        className="rounded-full border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--warning)] transition hover:bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void runAction(
                            () => deleteInterviewSlot(slot.id, admin.adminHeaders),
                            "Interview slot deleted."
                          )
                        }
                        className="rounded-full border border-[color-mix(in_srgb,var(--error)_30%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--error)] transition hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
                      >
                        Delete
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </ErpPageShell>
  );
}
