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

type PrototypeEventState = {
  registrations: string[];
  teams: Record<string, PrototypeEventTeam>;
};

function readState(): PrototypeEventState {
  if (typeof window === "undefined" || !window.localStorage) {
    return { registrations: [], teams: {} };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { registrations: [], teams: {} };
    const parsed = JSON.parse(raw) as Partial<PrototypeEventState>;
    return {
      registrations: Array.isArray(parsed.registrations) ? parsed.registrations : [],
      teams: parsed.teams && typeof parsed.teams === "object" ? parsed.teams : {},
    };
  } catch {
    return { registrations: [], teams: {} };
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
