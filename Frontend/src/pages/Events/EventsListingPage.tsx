import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, CalendarClock, Plus, Search, Sparkles, Users } from "lucide-react";
import { CompetitionCard, CompetitionEmptyPanel, CompetitionPageShell } from "../../components/competition/CompetitionChrome";
import { ErrorMessage } from "../../components/competition/ErrorMessage";
import { SkeletonCard } from "../../components/ui/Skeletons";
import { listEvents, type EventSummary } from "../../lib/campus/campusApi";
import { getPlatformRecommendations, recordPlatformRecommendationFeedback, type PlatformRecommendation } from "../../lib/career/profileApi";
import { track } from "../../lib/core/analytics";
import { Input } from "../../components/input";
import { Select } from "../../components/select";

const categories = ["All Categories", "Technical", "Cultural", "Sports", "Academic", "Workshop"];
const departments = ["All Departments", "CS Department", "Arts School", "Business Mgmt", "Student Union"];
const formats = ["All", "Online", "Offline"];
const dateRanges = ["All Dates", "This Week", "This Month"];

function getEventImage(event: EventSummary, index: number) {
  const image = event.posterImagePath || (event as Record<string, unknown>).coverImageUrl;
  if (typeof image === "string" && image.trim()) return `url("${image}")`;

  const gradients = [
    "linear-gradient(135deg, color-mix(in srgb, var(--surface) 90%, var(--accent-blue) 10%), color-mix(in srgb, var(--background) 88%, var(--accent-green) 12%))",
    "linear-gradient(135deg, color-mix(in srgb, var(--surface) 88%, var(--accent-blue) 12%), color-mix(in srgb, var(--background) 90%, var(--accent-yellow) 10%))",
    "linear-gradient(135deg, color-mix(in srgb, var(--surface) 90%, var(--accent-orange) 10%), color-mix(in srgb, var(--background) 90%, var(--accent-blue) 10%))",
    "linear-gradient(135deg, color-mix(in srgb, var(--surface) 91%, var(--accent-green) 9%), color-mix(in srgb, var(--background) 89%, var(--accent-blue) 11%))",
  ];
  return gradients[index % gradients.length];
}

function deadlineLabel(event: EventSummary) {
  const date = event.startAt || event.startDate;
  if (!date) return "TBA";
  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) return "Live";
  const hours = Math.ceil(diff / 3_600_000);
  if (hours < 24) return `${hours}H left`;
  return `${Math.ceil(hours / 24)} days left`;
}

function eventVenue(event: EventSummary) {
  if (typeof event.location === "string") return event.location;
  return event.location?.physical ?? event.venue ?? "Campus venue";
}

function FeaturedEventCard({ event, index }: { event: EventSummary; index: number }) {
  const navigate = useNavigate();
  const registrations = event.registeredCount ?? event.registrationCount ?? 0;

  return (
    <CompetitionCard className="mb-5 grid overflow-hidden md:grid-cols-[1fr_1.5fr]">
      <div
        className="min-h-52 bg-cover bg-center md:min-h-full"
        style={{ backgroundImage: getEventImage(event, index) }}
      />
      <div className="flex flex-col justify-center gap-3 p-6">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-secondary)]">{event.category || "Featured Event"}</span>
        <h2 className="m-0 text-2xl font-bold leading-tight text-[var(--text-primary)]">{event.title || "Untitled Event"}</h2>
        <p className="m-0 text-sm text-[var(--text-secondary)]">{event.description || "No description available."}</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
            <Building2 size={14} /> {event.department || "Campus"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
            <Users size={14} /> {registrations ? `${registrations.toLocaleString("en-IN")} registered` : "Open"}
          </span>
        </div>
        <div className="mt-2 flex gap-3">
          <button className="comp-btn-primary" onClick={() => navigate(`/events/${encodeURIComponent(event.id)}`)}>
            View Details
          </button>
          {event.prizes && (
            <span className="inline-flex items-center text-sm font-semibold text-[var(--comp-text-secondary)]">
              🏅 {event.prizes}
            </span>
          )}
        </div>
      </div>
    </CompetitionCard>
  );
}

function EventCard({ event, index }: { event: EventSummary; index: number }) {
  const navigate = useNavigate();
  const isOrganizerAction = event.createdBy || event.createdByUserId;
  const registrations = event.registeredCount ?? event.registrationCount ?? 0;

  return (
    <CompetitionCard className="overflow-hidden">
      <button
        className="relative h-40 w-full cursor-pointer border-0 bg-cover bg-center"
        style={{ backgroundImage: getEventImage(event, index) }}
        onClick={() => navigate(`/events/${encodeURIComponent(event.id)}`)}
        aria-label={`Open ${event.title}`}
      >
        <span className="absolute right-2.5 top-2.5 rounded-full bg-[color-mix(in_srgb,var(--accent-orange)_14%,var(--background)_86%)] px-2 py-1 text-[11px] font-bold uppercase text-[color-mix(in_srgb,var(--accent-orange)_70%,var(--text-primary)_30%)]">{deadlineLabel(event)}</span>
      </button>
      <div className="grid gap-2 p-5">
        <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-secondary)]">{event.category || "Event"}</p>
        <h2 className="m-0 min-h-[2.5em] text-[1.06rem] font-semibold leading-tight text-[var(--text-primary)]">{event.title || "Untitled Event"}</h2>
        <p className="m-0 inline-flex min-h-5 items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[var(--text-secondary)]">
          <Building2 size={14} />
          {event.department || eventVenue(event)}
        </p>
        <div className="my-1 h-px bg-[var(--border)]" />
        <div className="grid grid-cols-2 gap-3">
          <span>
            <small className="block text-[11px] font-bold uppercase text-[var(--text-secondary)]">Prizes</small>
            <strong className="text-sm text-[var(--text-primary)]">{event.prizes || "Merit"}</strong>
          </span>
          <span>
            <small className="block text-[11px] font-bold uppercase text-[var(--text-secondary)]">Reg.</small>
            <strong className="text-sm text-[var(--text-primary)]">{registrations ? registrations.toLocaleString("en-IN") : "Open"}</strong>
          </span>
        </div>
        <Link className="comp-btn-ghost mt-2" to={`/events/${encodeURIComponent(event.id)}`}>
          {isOrganizerAction ? "Review" : "View Details"}
        </Link>
      </div>
    </CompetitionCard>
  );
}

function RecommendationRail({
  recommendations,
  eventsById,
}: {
  recommendations: PlatformRecommendation[];
  eventsById: Map<string, EventSummary>;
}) {
  const visible = recommendations
    .map((recommendation) => ({
      recommendation,
      event: eventsById.get(recommendation.itemId),
    }))
    .filter((item): item is { recommendation: PlatformRecommendation; event: EventSummary } => Boolean(item.event))
    .slice(0, 3);

  if (!visible.length) return null;

  return (
    <section className="py-1" aria-label="Recommended events">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="m-0 inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            <Sparkles size={14} />
            Recommended for you
          </p>
          <h2 className="m-0 mt-1 text-lg font-semibold text-[var(--text-primary)]">Campus opportunities matched to your profile</h2>
        </div>
        <span className="text-xs font-semibold text-[var(--text-secondary)]">Profile signals</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {visible.map(({ recommendation, event }) => (
          <Link
            key={recommendation.impressionId || recommendation.itemId}
            to={recommendation.href || `/events/${encodeURIComponent(recommendation.itemId)}`}
            className="rounded-lg border border-[var(--border)] bg-[var(--dash-subcard-bg)] p-4 text-left no-underline transition hover:border-[color-mix(in_srgb,var(--accent-blue)_35%,var(--border))] hover:bg-[var(--background)]"
            onClick={() => {
              track("events_recommendation_clicked", {
                eventId: recommendation.itemId,
                impressionId: recommendation.impressionId,
                score: recommendation.score,
              });
              if (recommendation.impressionId) {
                void recordPlatformRecommendationFeedback({
                  impressionId: recommendation.impressionId,
                  action: "clicked",
                  metadata: { surface: "events_listing" },
                });
              }
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                  {recommendation.label || event.category || "Event match"}
                </p>
                <h3 className="m-0 mt-1 text-base font-semibold leading-snug text-[var(--text-primary)]">{event.title}</h3>
              </div>
              <span className="rounded-full border border-[color-mix(in_srgb,var(--accent-blue)_28%,var(--border))] px-2 py-0.5 text-xs font-semibold text-[var(--accent-blue)]">
                {Math.round(recommendation.score * 100)}%
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {recommendation.reasons.slice(0, 2).map((reason) => (
                <span key={reason} className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                  {reason}
                </span>
              ))}
            </div>
            <p className="m-0 mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <Building2 size={13} />
              {event.department || eventVenue(event)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function EventsListingPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [recommendations, setRecommendations] = useState<PlatformRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [error, setError] = useState("");
  const [recommendationError, setRecommendationError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [department, setDepartment] = useState(departments[0]);
  const [format, setFormat] = useState(formats[0]);
  const [dateRange, setDateRange] = useState(dateRanges[0]);

  const loadEvents = useCallback(() => {
    setLoading(true);
    setError("");
    listEvents()
      .then(setEvents)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load events."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    let active = true;
    setRecommendationsLoading(true);
    setRecommendationError("");
    getPlatformRecommendations("events")
      .then((response) => {
        if (!active) return;
        setRecommendations(response.items || []);
        if (response.items?.length) {
          track("events_recommendations_viewed", {
            count: response.items.length,
            topEventId: response.items[0]?.itemId,
          });
        }
      })
      .catch((err: unknown) => {
        if (active) setRecommendationError(err instanceof Error ? err.message : "Failed to load event recommendations.");
      })
      .finally(() => {
        if (active) setRecommendationsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const eventsById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((event) => {
      const matchesQuery =
        !q ||
        [event.title, event.description, event.category, event.department]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      const matchesCategory = category === categories[0] || event.category === category;
      const matchesDepartment = department === departments[0] || event.department === department;
      const venue = eventVenue(event).toLowerCase();
      const matchesFormat =
        format === "All" ||
        (format === "Online" ? venue.includes("online") || venue.includes("http") : !venue.includes("online"));

      // Date range filter
      let matchesDate = true;
      if (dateRange !== "All Dates") {
        const eventDate = new Date(event.startAt || event.startDate);
        const now = new Date();
        if (dateRange === "This Week") {
          const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          matchesDate = eventDate >= now && eventDate <= weekEnd;
        } else if (dateRange === "This Month") {
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          matchesDate = eventDate >= now && eventDate <= monthEnd;
        }
      }

      return matchesQuery && matchesCategory && matchesDepartment && matchesFormat && matchesDate;
    });
  }, [category, dateRange, department, events, format, query]);

  return (
    <CompetitionPageShell
      title="Active Events"
      subtitle="Find campus events, check deadlines, and register from one place."
      actions={
        <Link className="comp-btn-primary" to="/events/create">
          <Plus size={18} />
          Host event
        </Link>
      }
      variant="wide"
    >
      <section className="dashboard-card grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_auto]" aria-label="Event filters">
        <label>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">Search</span>
          <div className="flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--dash-subcard-bg)] px-3">
            <Search size={16} />
            <Input className="h-full border-0 bg-transparent px-0 shadow-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events..." />
          </div>
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">Category</span>
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </Select>
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">Department</span>
          <Select value={department} onChange={(event) => setDepartment(event.target.value)}>
            {departments.map((item) => <option key={item}>{item}</option>)}
          </Select>
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">Date Range</span>
          <div className="flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--dash-subcard-bg)] px-3">
            <CalendarClock size={16} />
            <Select value={dateRange} onChange={(event) => setDateRange(event.target.value)}>
              {dateRanges.map((item) => <option key={item}>{item}</option>)}
            </Select>
          </div>
        </label>
        <div className="inline-grid h-11 grid-flow-col items-center gap-1 rounded-xl bg-[var(--dash-subcard-bg)] p-1" role="group" aria-label="Format">
          {formats.map((item) => (
            <button
              key={item}
              className={`h-8 min-w-20 rounded-lg border-0 px-2 text-sm ${format === item ? "bg-[var(--background)] text-[var(--text-primary)]" : "bg-transparent text-[var(--text-secondary)]"}`}
              onClick={() => setFormat(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {error ? <ErrorMessage title="Events could not load" message={error} onRetry={loadEvents} /> : null}
      {!recommendationsLoading && !recommendationError ? (
        <RecommendationRail recommendations={recommendations} eventsById={eventsById} />
      ) : null}

      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
          {[1, 2, 3, 4, 5].map((item) => <SkeletonCard key={item} />)}
        </div>
      ) : filteredEvents.length ? (
        <>
          {filteredEvents.length > 0 ? (
            <FeaturedEventCard event={filteredEvents[0]} index={0} />
          ) : null}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
            {filteredEvents.slice(1).map((event, index) => <EventCard key={event.id} event={event} index={index + 1} />)}
            <Link className="grid min-h-36 place-items-center content-center gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--dash-subcard-bg)] text-center no-underline text-[var(--text-primary)]" to="/events/create">
              <Plus size={24} />
              <strong>Host event</strong>
              <span className="text-xs text-[var(--text-secondary)]">Host a department activity</span>
            </Link>
          </div>
          <div className="mt-8 flex items-center justify-between gap-4 border-t border-[var(--border)] pt-5 text-sm text-[var(--text-secondary)]">
            <span data-page-contrast="true">Showing {filteredEvents.length} of {events.length} active events</span>
            <span data-page-contrast="true" className="inline-flex items-center gap-2"><Users size={15} /> Registration data updates live</span>
          </div>
        </>
      ) : (
        <CompetitionEmptyPanel
          title={query || category !== categories[0] || department !== departments[0] || format !== formats[0] || dateRange !== dateRanges[0] ? "No matching events" : "No events are open right now"}
          description={query || category !== categories[0] || department !== departments[0] || format !== formats[0] || dateRange !== dateRanges[0] ? "Clear your filters to see every active event, or broaden your search." : "Check again later, or host the next campus activity if you are organizing one."}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="comp-btn-ghost"
                onClick={() => {
                  setQuery("");
                  setCategory(categories[0]);
                  setDepartment(departments[0]);
                  setFormat(formats[0]);
                  setDateRange(dateRanges[0]);
                }}
              >
                Clear filters
              </button>
              <Link className="comp-btn-primary" to="/events/create">Host event</Link>
            </div>
          }
        />
      )}
    </CompetitionPageShell>
  );
}
