/**
 * Minimal client-side state for the static prototype.
 *
 * The deployed prototype intentionally has no write API. Keeping registration
 * and team state in localStorage lets students complete and review the event
 * journeys without pretending that a server-side registration was created.
 */

const STORAGE_KEY = "universe.static-event-state.v1";

export type PrototypeEventTeam = {
  id: string;
  eventId: string;
  name: string;
  leaderRegNo: string;
  members: Array<{
    regNo: string;
    name: string;
    joinedAt: string;
    status: "pending" | "accepted";
  }>;
  createdAt: string;
};

export type PrototypePersistentTeam = {
  id: string;
  name: string;
  leaderRegNo: string;
  members: Array<{
    regNo: string;
    name: string;
    joinedAt: string;
    status: "pending" | "accepted";
  }>;
  createdAt: string;
};

export type PrototypeTeamInvitation = {
  id: string;
  teamId: string;
  teamName: string;
  inviteeRegisterNumber: string;
  inviterRegisterNumber: string;
  eventId?: string; // Optional - if set, this is for event registration
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
};

type PrototypeEventState = {
  registrations: string[];
  teams: Record<string, PrototypeEventTeam>;
  persistentTeams: Record<string, PrototypePersistentTeam>;
  teamInvitations: Record<string, PrototypeTeamInvitation[]>; // keyed by invitee reg no
};

function readState(): PrototypeEventState {
  if (typeof window === "undefined" || !window.localStorage) {
    return { registrations: [], teams: {}, persistentTeams: {}, teamInvitations: {} };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { registrations: [], teams: {}, persistentTeams: {}, teamInvitations: {} };
    const parsed = JSON.parse(raw) as Partial<PrototypeEventState>;
    return {
      registrations: Array.isArray(parsed.registrations) ? parsed.registrations : [],
      teams: parsed.teams && typeof parsed.teams === "object" ? parsed.teams : {},
      persistentTeams: parsed.persistentTeams && typeof parsed.persistentTeams === "object" ? parsed.persistentTeams : {},
      teamInvitations: parsed.teamInvitations && typeof parsed.teamInvitations === "object" ? parsed.teamInvitations : {},
    };
  } catch {
    return { registrations: [], teams: {}, persistentTeams: {}, teamInvitations: {} };
  }
}

function writeState(state: PrototypeEventState) {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function isPrototypeEventRegistered(eventId: string) {
  return readState().registrations.includes(eventId);
}

export function setPrototypeEventRegistration(eventId: string, registered: boolean) {
  const state = readState();
  const registrations = new Set(state.registrations);
  if (registered) registrations.add(eventId);
  else registrations.delete(eventId);
  writeState({ ...state, registrations: Array.from(registrations) });
}

export function getPrototypeEventTeam(eventId: string) {
  return readState().teams[eventId] ?? null;
}

export function savePrototypeEventTeam(team: PrototypeEventTeam) {
  const state = readState();
  writeState({ ...state, teams: { ...state.teams, [team.eventId]: team } });
  return team;
}

// Prototype implementations for new team features
export function getPrototypeEventInvitations(eventId: string): Array<{
  id: string;
  eventId: string;
  teamId: string;
  teamName: string;
  inviteeRegisterNumber: string;
  inviterRegisterNumber: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
}> {
  const state = readState();
  const team = state.teams[eventId];
  if (!team) return [];
  // In prototype mode, we don't persist invitations separately
  // Return empty array - the UI will show no pending invitations
  return [];
}

export function deletePrototypeEventTeam(eventId: string): void {
  const state = readState();
  if (state.teams[eventId]) {
    delete state.teams[eventId];
    writeState(state);
  }
}

// ─── Persistent Team Functions ─────────────────────────────────────────────────

export function getPrototypePersistentTeams(): PrototypePersistentTeam[] {
  const state = readState();
  return Object.values(state.persistentTeams);
}

export function getPrototypePersistentTeam(teamId: string): PrototypePersistentTeam | null {
  const state = readState();
  return state.persistentTeams[teamId] ?? null;
}

export function savePrototypePersistentTeam(team: PrototypePersistentTeam): PrototypePersistentTeam {
  const state = readState();
  writeState({ ...state, persistentTeams: { ...state.persistentTeams, [team.id]: team } });
  return team;
}

export function deletePrototypePersistentTeam(teamId: string): void {
  const state = readState();
  if (state.persistentTeams[teamId]) {
    delete state.persistentTeams[teamId];
    writeState(state);
  }
}

// ─── Team Invitation Functions ─────────────────────────────────────────────────

export function getPrototypeTeamInvitations(inviteeRegNo: string): PrototypeTeamInvitation[] {
  const state = readState();
  return state.teamInvitations[inviteeRegNo] ?? [];
}

export function savePrototypeTeamInvitation(invitation: PrototypeTeamInvitation): void {
  const state = readState();
  const existing = state.teamInvitations[invitation.inviteeRegisterNumber] ?? [];
  // Remove any existing invitation with same teamId for this invitee
  const filtered = existing.filter(inv => inv.teamId !== invitation.teamId);
  writeState({ ...state, teamInvitations: { ...state.teamInvitations, [invitation.inviteeRegisterNumber]: [...filtered, invitation] } });
}

export function updatePrototypeTeamInvitationStatus(inviteeRegNo: string, teamId: string, status: PrototypeTeamInvitation['status']): void {
  const state = readState();
  const existing = state.teamInvitations[inviteeRegNo] ?? [];
  const updated = existing.map(inv => inv.teamId === teamId ? { ...inv, status } : inv);
  writeState({ ...state, teamInvitations: { ...state.teamInvitations, [inviteeRegNo]: updated } });
}

export function deletePrototypeTeamInvitation(inviteeRegNo: string, teamId: string): void {
  const state = readState();
  const existing = state.teamInvitations[inviteeRegNo] ?? [];
  const updated = existing.filter(inv => inv.teamId !== teamId);
  writeState({ ...state, teamInvitations: { ...state.teamInvitations, [inviteeRegNo]: updated } });
}
