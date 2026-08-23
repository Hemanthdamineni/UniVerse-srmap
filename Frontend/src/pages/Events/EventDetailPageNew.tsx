import { useMemo, useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, CalendarDays, MapPin, Users } from "lucide-react";
import { CompetitionCard, CompetitionPageShell } from "../../components/competition/CompetitionChrome";
import { GlobalLoadingBoundary, useEvent } from "../../contexts/EventContext";
import { Markdown } from "../../components/markdown";
import { StatusBadge } from "../../components/ui/Badges";
import { registerForEvent, cancelEventRegistration, type CompetitionRound } from "../../lib/campus/campusApi";

type DetailTab = "overview" | "rounds" | "timeline" | "rules";

/** Parse a rules string like "1.Foo 2. Bar 3. Baz" into individual items. */
function parseNumberedRules(text: string): string[] {
  const items = text
    .split(/(?<=\S)\s+(?=\d+[.)]\s)/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : [text];
}

function formatDate(date?: string) {
  if (!date) return "TBA";
  return new Date(date).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(date?: string) {
  if (!date) return "TBA";
  return new Date(date).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function eventVenue(event: NonNullable<ReturnType<typeof useEvent>["event"]>) {
  if (typeof event.location === "string") return event.location;
  return event.location?.physical ?? event.venue ?? "Campus venue";
}

export default function EventDetailPageNew() {
  const { event, config, userState, loading, error, refetch } = useEvent();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<DetailTab>("overview");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const rounds = useMemo(() => config?.rounds ?? [], [config]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the intersecting entry with the highest intersection ratio
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length > 0) {
          // Sort by intersection ratio to get the most visible one
          visibleEntries.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          setActiveSection(visibleEntries[0].target.id as DetailTab);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) observerRef.current?.observe(ref);
    });

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [loading, event]);

  const scrollToSection = (id: DetailTab) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      // Offset by roughly the header height + some padding
      const yOffset = -100;
      const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  if (loading) return <GlobalLoadingBoundary />;

  if (error || !event) {
    return (
      <CompetitionPageShell title="Event Not Found" subtitle={error ?? "This event could not be loaded."}>
        <CompetitionCard className="competition-empty-panel">
          <button className="comp-btn-primary" onClick={() => refetch(true)}>Retry</button>
          <Link className="comp-btn-ghost" to="/events">Back to events</Link>
        </CompetitionCard>
      </CompetitionPageShell>
    );
  }

  const loadedEvent = event;
  const registeredCount = loadedEvent.registeredCount ?? loadedEvent.registrationCount ?? 0;
  const isStaff = Boolean(userState?.canEdit || userState?.canEvaluate || userState?.canViewAllSubmissions);
  const isRegistered = userState?.role === "participant";
  const canRegister = userState?.role === "visitor" && !isStaff;
  const activeRound = rounds.find((round) => round.submissionDeadline && new Date(round.submissionDeadline) > new Date());

  async function runAction(action: "register" | "cancel") {
    setBusy(true);
    setNotice("");
    try {
      if (action === "register") {
        await registerForEvent(loadedEvent.id);
        setNotice("Registration confirmed.");
      } else {
        await cancelEventRegistration(loadedEvent.id);
        setNotice("Registration cancelled.");
      }
      refetch(true);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  function roundAction(round: CompetitionRound) {
    const state = userState?.roundStates.find((item) => item.roundId === round.roundId);
    if (state?.canSubmit) {
      return <Link className="comp-btn-primary" to={`/events/${loadedEvent.id}/submit/${round.roundId}`}>Submit entry</Link>;
    }
    if (round.resultsPublished || state?.canViewResults) {
      return <Link className="comp-btn-ghost" to={`/events/${loadedEvent.id}/my-results/${round.roundId}`}>Results</Link>;
    }
    if (userState?.canViewAllSubmissions) {
      return <Link className="comp-btn-ghost" to={`/events/${loadedEvent.id}/manage/rounds/${round.roundId}/submissions`}>Review</Link>;
    }
    return <StatusBadge status="Locked" preset="neutral" label="Locked" />;
  }

  return (
    <CompetitionPageShell variant="wide">
      <section className="event-detail-hero">
        <div>
          <StatusBadge status={event.status || "Active"} dot />
          {event.category ? <span className="competition-pill">{event.category}</span> : null}
        </div>
        <h1>{event.title || "Untitled Event"}</h1>
        <div className="event-detail-hero-copy">
          <Markdown>{event.description || "Event details will be updated by the organizer."}</Markdown>
        </div>
        <div className="event-detail-meta">
          <span><CalendarDays size={18} /> {formatDate(event.startAt || event.startDate)} - {formatDate(event.endAt || event.endDate)}</span>
          <span><MapPin size={18} /> {eventVenue(event)}</span>
          <span><Users size={18} /> {registeredCount} Registered</span>
        </div>
      </section>

      {notice ? <div className="event-detail-notice" role="status">{notice}</div> : null}

      <div className="competition-grid two event-detail-layout">
        <div className="event-detail-main">
          <section id="overview" ref={(el) => { sectionRefs.current.overview = el; }} className="event-detail-section">
            <CompetitionCard className="event-detail-panel">
              <h2>Event Overview</h2>
              <div className="event-detail-body">
                <Markdown>{event.description || "Join the competition, collaborate with peers, and follow every round from registration through results."}</Markdown>
              </div>
              <div className="event-detail-facts">
                <span><Building2 size={17} /> {event.department || "University"}</span>
                <span><MapPin size={17} /> {eventVenue(event)}</span>
                <span><Users size={17} /> {registeredCount} participants</span>
              </div>
              {activeRound ? (
                <Link className="comp-btn-ghost" to={`/events/${event.id}/leaderboard/${activeRound.roundId}`}>
                  View leaderboard
                </Link>
              ) : null}
            </CompetitionCard>
          </section>

          <section id="rounds" ref={(el) => { sectionRefs.current.rounds = el; }} className="event-detail-section">
            <div className="event-round-list">
              {rounds.length ? rounds.map((round, index) => (
                <CompetitionCard key={round.roundId} className="event-round-card">
                  <span className="competition-pill">Round {index + 1}</span>
                  <h2>{round.title}</h2>
                  <div className="event-detail-body">
                    <Markdown>{round.instructions || "Submit work before the deadline and track results after evaluation."}</Markdown>
                  </div>
                  <div className="event-detail-facts">
                    <span>Deadline: {formatDateTime(round.submissionDeadline)}</span>
                    <span>{round.resultsPublished ? "Results published" : "Evaluation pending"}</span>
                  </div>
                  <div>{roundAction(round)}</div>
                </CompetitionCard>
              )) : (
                <CompetitionCard className="event-detail-panel">
                  <h2>No rounds configured</h2>
                  <p>This event is not configured as a multi-round competition yet.</p>
                </CompetitionCard>
              )}
            </div>
          </section>

          <section id="timeline" ref={(el) => { sectionRefs.current.timeline = el; }} className="event-detail-section">
            <CompetitionCard className="event-detail-panel">
              <h2>Timeline</h2>
              <ol className="event-timeline">
                <li>
                  <span className="event-timeline-dot" />
                  <div className="event-timeline-content">
                    <span className="event-timeline-label">Registration opens</span>
                    <strong className="event-timeline-date">{formatDate(event.startAt || event.startDate)}</strong>
                  </div>
                </li>
                {rounds.map((round) => (
                  <li key={round.roundId}>
                    <span className="event-timeline-dot" />
                    <div className="event-timeline-content">
                      <span className="event-timeline-label">{round.title} closes</span>
                      <strong className="event-timeline-date">{formatDateTime(round.submissionDeadline)}</strong>
                    </div>
                  </li>
                ))}
                <li>
                  <span className="event-timeline-dot" />
                  <div className="event-timeline-content">
                    <span className="event-timeline-label">Results and certificates</span>
                    <strong className="event-timeline-date">After evaluation</strong>
                  </div>
                </li>
              </ol>
            </CompetitionCard>
          </section>

          <section id="rules" ref={(el) => { sectionRefs.current.rules = el; }} className="event-detail-section">
            <CompetitionCard className="event-detail-panel">
              <h2>Rules & Guidelines</h2>
              <ol className="event-rules-list">
                {parseNumberedRules(
                  event.rules || event.eligibility || "Participants must follow organizer instructions, submit original work, and respect all university competition policies."
                ).map((rule, i) => (
                  <li key={i}>
                    <Markdown>{rule.replace(/^\d+[.)]\s*/, "")}</Markdown>
                  </li>
                ))}
              </ol>
              {event.prizes ? (
                <div className="event-detail-body mt-3 text-sm">
                  <strong>Prizes:</strong>
                  <Markdown>{event.prizes}</Markdown>
                </div>
              ) : null}
            </CompetitionCard>
          </section>
        </div>

        {/* Below lg the sidebar dissolves (contents) so the register/action card
            leads the page while the nav card stays after the main content. */}
        <div className="event-detail-sidebar">
          <CompetitionCard className="event-detail-nav">
            <h2>Navigation</h2>
            {[
              ["overview", "Event Overview"],
              ["rounds", "Competition Rounds"],
              ["timeline", "Timeline"],
              ["rules", "Rules & Guidelines"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={activeSection === id ? "is-active" : ""}
                onClick={() => scrollToSection(id as DetailTab)}
                type="button"
              >
                {label}
              </button>
            ))}
          </CompetitionCard>

          <CompetitionCard className="event-detail-action-card">
            <div className="event-detail-action-status">
              <strong>{isRegistered ? "You are registered" : "Standard Registration"}</strong>
              <span>{activeRound ? `Next deadline: ${formatDateTime(activeRound.submissionDeadline)}` : "Competition details available"}</span>
            </div>
            <div className="event-detail-action-buttons">
              {canRegister ? (
                config?.isCompetition && config.submissionScope === "team" ? (
                  <Link className="comp-btn-primary" to={`/events/${encodeURIComponent(loadedEvent.id)}/register`}>Set up team</Link>
                ) : (
                  <button className="comp-btn-primary" disabled={busy} onClick={() => void runAction("register")}>Register Now</button>
                )
              ) : null}
              {isRegistered ? (
                <button className="comp-btn-ghost" disabled={busy} onClick={() => void runAction("cancel")}>Cancel Registration</button>
              ) : null}
              {isStaff ? (
                <button className="comp-btn-primary" onClick={() => navigate(`/events/${event.id}/manage`)}>Organizer Workspace</button>
              ) : null}
            </div>
          </CompetitionCard>
        </div>
      </div>
    </CompetitionPageShell>
  );
}
