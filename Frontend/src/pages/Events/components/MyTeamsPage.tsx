import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Award, CalendarClock, Plus, Users } from "lucide-react";
import { ErrorMessage } from "../../../components/competition/ErrorMessage";
import { SkeletonCard } from "../../../components/ui/Skeletons";
import { StatusBadge } from "../../../components/ui/Badges";
import { CompetitionPageShell, CompetitionCard, CompetitionEmptyPanel } from "../../../components/competition/CompetitionChrome";
import { computeTeamScore } from "../../../lib/events/scoring";
import {
  getMyInvitations,
  getMyPersistentTeamInvitations,
  getMyPersistentTeams,
  getMyRegisteredEvents,
  getMyScores,
  getMyTeam,
  type EventSummary,
  type PersistentTeam,
  type PersistentTeamInvitation,
  type ScoreBreakdown,
  type Team,
  type TeamInvitation,
} from "../../../lib/events/competitionsApi";
import { listEvents, type EventSummary as CampusEventSummary } from "../../../lib/campus/campusApi";
import { getCurrentRegNo } from "../../../lib/core/identity";
import ScoreCard from "../../../components/competition/ScoreCard";
import { CreatePersistentTeamForm } from "./CreatePersistentTeamForm";

export function MyTeamsPage() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<Array<{ event: EventSummary; team: Team }>>([]);
  const [availableEvents, setAvailableEvents] = useState<EventSummary[]>([]);
  const [invitations, setInvitations] = useState<Array<{ event: EventSummary; invitation: TeamInvitation }>>([]);
  const [persistentTeams, setPersistentTeams] = useState<PersistentTeam[]>([]);
  const [persistentInvitations, setPersistentInvitations] = useState<PersistentTeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAvailable, setLoadingAvailable] = useState(true);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(null);
  const [scoreError, setScoreError] = useState("");
  const [loadingPersistentTeams, setLoadingPersistentTeams] = useState(true);
  const [loadingPersistentInvitations, setLoadingPersistentInvitations] = useState(true);
  const [error, setError] = useState("");
  const currentRegNo = getCurrentRegNo();

  const tabs = [
    { id: "active", label: "Active Teams" },
    { id: "completed", label: "Completed Teams" },
    { id: "invitations", label: "Invitations" },
    { id: "my-teams", label: "My Teams" },
    { id: "persistent-invites", label: "Team Invites" },
    { id: "create", label: "Create Team" },
  ] as const;

  type TabId = (typeof tabs)[number]["id"];
  const selectedTab = (params.get("tab") || "active") as TabId;
  const activeTab = tabs.some((tab) => tab.id === selectedTab) ? selectedTab : "active";

  // Teams and invitations both key off the registered-events list; fetching
  // that list once (instead of once per loader) halves the fan-out on mount.
  const loadTeamsAndInvitations = useCallback(() => {
    setLoading(true);
    setLoadingInvitations(true);
    setError("");
    getMyRegisteredEvents()
      .then(async (events) => {
        const [pairs, allInvitations] = await Promise.all([
          Promise.all(
            events.map(async (event) => {
              const team = await getMyTeam(event.id);
              return team ? { event, team } : null;
            })
          ).then((loaded) => loaded.filter(Boolean) as Array<{ event: EventSummary; team: Team }>),
          Promise.all(
            events.map(async (event) => {
              try {
                const invs = await getMyInvitations(event.id);
                return invs.map((invitation) => ({ event, invitation }));
              } catch {
                return [];
              }
            })
          ).then((groups) => groups.flat()),
        ]);
        return { pairs, allInvitations };
      })
      .then(({ pairs, allInvitations }) => {
        setItems(pairs);
        setInvitations(allInvitations);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load teams."))
      .finally(() => {
        setLoading(false);
        setLoadingInvitations(false);
      });
  }, []);

  const loadAvailableEvents = useCallback(() => {
    setLoadingAvailable(true);
    listEvents()
      .then((events: CampusEventSummary[]) => {
        // Filter events that are team competitions and open for registration
        const teamEvents = events.filter(
          (e: CampusEventSummary) => e.competitionConfig?.isCompetition && e.competitionConfig?.submissionScope === "team" &&
                 !["archived", "completed", "closed", "registration-closed"].includes(e.status || "")
        );
        setAvailableEvents(teamEvents as EventSummary[]);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load events."))
      .finally(() => setLoadingAvailable(false));
  }, []);

  const loadPersistentTeams = useCallback(() => {
    setLoadingPersistentTeams(true);
    getMyPersistentTeams()
      .then(setPersistentTeams)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load persistent teams."))
      .finally(() => setLoadingPersistentTeams(false));
  }, []);

  const loadPersistentInvitations = useCallback(() => {
    setLoadingPersistentInvitations(true);
    getMyPersistentTeamInvitations()
      .then(setPersistentInvitations)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load persistent team invitations."))
      .finally(() => setLoadingPersistentInvitations(false));
  }, []);

  useEffect(() => {
    loadTeamsAndInvitations();
    loadAvailableEvents();
    loadPersistentTeams();
    loadPersistentInvitations();
    getMyScores()
      .then((data) => setScoreBreakdown(data.team))
      .catch((err: unknown) =>
        setScoreError(err instanceof Error ? err.message : "Failed to load team score.")
      );
  }, [loadTeamsAndInvitations, loadAvailableEvents, loadPersistentTeams, loadPersistentInvitations]);

  const activeTeams = useMemo(
    () => items.filter(({ event }) => !["completed", "archived"].includes(event.status)),
    [items],
  );
  const completedTeams = useMemo(
    () => items.filter(({ event }) => ["completed", "results-published"].includes(event.status)),
    [items],
  );
  const upcomingDeadlines = activeTeams.filter(({ event }) => event.startAt || event.startDate).slice(0, 3);
  const fallbackTeamScore = useMemo(
    () => computeTeamScore({ activeTeams, persistentTeams, currentRegNo }),
    [activeTeams, persistentTeams, currentRegNo],
  );
  const teamBreakdown: ScoreBreakdown = scoreBreakdown ?? {
    ...fallbackTeamScore,
    headlineBand: scoreError ? "Live score unavailable" : "Updating…",
  };

  function setTab(tab: TabId) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  }

  function formatDate(date?: string) {
    return date ? new Date(date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "TBA";
  }

  function TeamRow({ event, team }: { event: EventSummary; team: Team }) {
    const isLeader = team.leaderRegNo === currentRegNo;
    const teamUrl = `/events/${encodeURIComponent(event.id)}/teams/${encodeURIComponent(team.id)}`;
    return (
      <CompetitionCard className="activity-event-row">
        <span className="activity-event-icon"><Users size={22} /></span>
        <div>
          <h2>{team.name}</h2>
          <p>{event.title ?? "Untitled event"} · {formatDate(event.startAt || event.startDate)}</p>
        </div>
        <span className="competition-pill">{isLeader ? "Leader" : "Member"}</span>
        <div className="activity-event-actions">
          <Link className="comp-btn-ghost" to={teamUrl}>View</Link>
          <Link className="comp-btn-primary" to={`/events/${encodeURIComponent(event.id)}`}>Event</Link>
        </div>
      </CompetitionCard>
    );
  }

  function AvailableEventCard({ event }: { event: EventSummary }) {
    const alreadyHasTeam = items.some(({ event: e }) => e.id === event.id);
    const maxTeamSize = event.competitionConfig?.maxTeamSize || 4;
    return (
      <CompetitionCard className={alreadyHasTeam ? "activity-event-row activity-event-row-muted" : "activity-event-row"}>
        <span className="activity-event-icon"><Plus size={22} /></span>
        <div>
          <h2>{event.title}</h2>
          <p>Team competition · Up to {maxTeamSize} members · {formatDate(event.startAt || event.startDate)}</p>
        </div>
        <StatusBadge status={event.status || "Active"} dot />
        <div className="activity-event-actions">
          <Link className="comp-btn-ghost" to={`/events/${encodeURIComponent(event.id)}`}>Details</Link>
          {alreadyHasTeam ? (
            <Link className="comp-btn-ghost" to={`/events/${encodeURIComponent(event.id)}/teams/${encodeURIComponent(items.find(({ event: e }) => e.id === event.id)?.team.id ?? "")}`}>View Team</Link>
          ) : (
            <Link className="comp-btn-primary" to={`/events/${encodeURIComponent(event.id)}/teams/create`}>Create Team</Link>
          )}
        </div>
      </CompetitionCard>
    );
  }

  return (
    <CompetitionPageShell
      eyebrow="Student Workspace"
      title="My Teams"
      subtitle="Track team formations, create new teams, and invite members across competitions."
      variant="wide"
    >
      <div className="activity-dashboard-grid">
        <div className="activity-main-column">
          <div className="activity-tabs" role="tablist" aria-label="Team sections">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                id={`team-tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls="team-tabpanel"
                className={activeTab === tab.id ? "is-active" : ""}
                onClick={() => setTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div id="team-tabpanel" role="tabpanel" aria-labelledby={`team-tab-${activeTab}`}>
          {error ? <ErrorMessage message={error} onRetry={loadTeamsAndInvitations} /> : null}

          {loading ? (
            <div className="activity-list">
              {[1, 2, 3].map((item) => <SkeletonCard key={item} />)}
            </div>
          ) : activeTab === "active" ? (
            activeTeams.length ? (
              <div className="activity-list">
                {activeTeams.map(({ event, team }) => <TeamRow key={team.id} event={event} team={team} />)}
              </div>
            ) : (
              <CompetitionEmptyPanel
                title="No active teams"
                description="Join or create teams for upcoming competitions to track them here."
                action={<Link className="comp-btn-primary" to="/events">Discover Events</Link>}
              />
            )
          ) : activeTab === "completed" ? (
            completedTeams.length ? (
              <div className="activity-list">
                {completedTeams.map(({ event, team }) => <TeamRow key={team.id} event={event} team={team} />)}
              </div>
            ) : (
              <CompetitionEmptyPanel title="No completed teams" description="Completed team competitions will appear here after results are published." />
            )
          ) : activeTab === "invitations" ? (
            loadingInvitations ? (
              <div className="activity-list">
                {[1, 2, 3].map((item) => <SkeletonCard key={item} />)}
              </div>
            ) : invitations.length ? (
              <div className="activity-list">
                {invitations.map(({ event, invitation }) => (
                  <CompetitionCard key={invitation.id} className="activity-event-row">
                    <span className="activity-event-icon"><Users size={22} /></span>
                    <div>
                      <h2>{invitation.teamName}</h2>
                      <p>{event.title ?? "Untitled event"} · Invited by {invitation.inviterRegisterNumber}</p>
                    </div>
                    <StatusBadge status="Pending" />
                    <div className="activity-event-actions">
                      <Link className="comp-btn-primary" to={`/events/${encodeURIComponent(event.id)}/invitations`}>View</Link>
                    </div>
                  </CompetitionCard>
                ))}
              </div>
            ) : (
              <CompetitionEmptyPanel
                title="No pending invitations"
                description="Team invitations will appear here when someone invites you."
              />
            )
          ) : activeTab === "my-teams" ? (
            loadingPersistentTeams ? (
              <div className="activity-list">
                {[1, 2, 3].map((item) => <SkeletonCard key={item} />)}
              </div>
            ) : persistentTeams.length ? (
              <div className="activity-list">
                {persistentTeams.map((team) => (
                  <CompetitionCard key={team.id} className="activity-event-row">
                    <span className="activity-event-icon"><Users size={22} /></span>
                    <div>
                      <h2>{team.name}</h2>
                      <p>{team.members.length} member{team.members.length > 1 ? 's' : ''} · {team.leaderRegNo === currentRegNo ? 'You are the leader' : 'Member'}</p>
                    </div>
                    <span className="competition-pill">{team.leaderRegNo === currentRegNo ? 'Leader' : 'Member'}</span>
                    <div className="activity-event-actions">
                      <Link className="comp-btn-primary" to={`/teams/persistent/${encodeURIComponent(team.id)}`}>Manage</Link>
                    </div>
                  </CompetitionCard>
                ))}
              </div>
            ) : (
              <CompetitionEmptyPanel
                title="No persistent teams"
                description="Create a persistent team to group up with friends. When you find an event, invite the whole team to register together."
                action={<Link className="comp-btn-primary" to="/events/my-teams?tab=create">Create Team</Link>}
              />
            )
          ) : activeTab === "persistent-invites" ? (
            loadingPersistentInvitations ? (
              <div className="activity-list">
                {[1, 2, 3].map((item) => <SkeletonCard key={item} />)}
              </div>
            ) : persistentInvitations.length ? (
              <div className="activity-list">
                {persistentInvitations.map((invitation) => (
                  <CompetitionCard key={invitation.id} className="activity-event-row">
                    <span className="activity-event-icon"><Users size={22} /></span>
                    <div>
                      <h2>{invitation.teamName}</h2>
                      <p>Invited by {invitation.inviterRegisterNumber} · {new Date(invitation.createdAt).toLocaleDateString()}</p>
                    </div>
                    <StatusBadge status="Pending" />
                    <div className="activity-event-actions">
                      <Link className="comp-btn-primary" to={`/teams/persistent/${encodeURIComponent(invitation.teamId)}`}>Manage</Link>
                    </div>
                  </CompetitionCard>
                ))}
              </div>
            ) : (
              <CompetitionEmptyPanel
                title="No persistent team invitations"
                description="When someone invites you to a persistent team, it will appear here."
              />
            )
          ) : activeTab === "create" ? (
            <CreatePersistentTeamForm onCreated={() => { loadPersistentTeams(); setTab("my-teams"); }} />
          ) : loadingAvailable ? (
            <div className="activity-list">
              {[1, 2, 3].map((item) => <SkeletonCard key={item} />)}
            </div>
          ) : availableEvents.length ? (
            <div className="activity-list">
              {availableEvents.map((event) => <AvailableEventCard key={event.id} event={event} />)}
            </div>
          ) : (
            <CompetitionEmptyPanel
              title="No team events available"
              description="Register for team competitions to create or join teams."
              action={<Link className="comp-btn-primary" to="/events">Discover Events</Link>}
            />
          )}
          </div>
        </div>

        <aside className="activity-side-column">
          <ScoreCard
            title="Team Score"
            icon={<Award size={28} />}
            breakdown={teamBreakdown}
            blurb={
              scoreError
                ? "Live score unavailable — showing estimate from this page's data."
                : "Based on leadership roles, roster health, and engagement across event and persistent teams."
            }
          />
          <CompetitionCard className="activity-deadline-card">
            <h2>Upcoming Deadlines</h2>
            {upcomingDeadlines.length ? upcomingDeadlines.map(({ event, team }) => (
              <Link key={team.id} to={`/events/${encodeURIComponent(event.id)}/teams/${encodeURIComponent(team.id)}`}>
                <CalendarClock size={20} />
                <span>
                  <strong>{team.name}</strong>
                  <small>{event.title ?? "Untitled event"} · {formatDate(event.startAt || event.startDate)}</small>
                </span>
              </Link>
            )) : <p>No upcoming deadlines.</p>}
          </CompetitionCard>
        </aside>
      </div>
    </CompetitionPageShell>
  );
}