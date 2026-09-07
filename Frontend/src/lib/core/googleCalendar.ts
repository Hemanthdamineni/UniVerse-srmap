/**
 * googleCalendar.ts — client for the Google Calendar sync endpoints
 * (Batch B10 / Story 6.3).
 */

import { requestData } from "./apiClient";

export interface GoogleCalendarStatus {
  available: boolean;
  connected: boolean;
  calendarId?: string | null;
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
  syncedCount?: number;
}

export interface SyncResult {
  timetable: { upserted: number } | null;
  deadlines: { upserted: number } | null;
}

export function getGoogleCalendarStatus(): Promise<GoogleCalendarStatus> {
  return requestData<GoogleCalendarStatus>("/api/integrations/google/status");
}

/** Returns the consent-screen URL to send the user to. */
export function getGoogleConnectUrl(): Promise<{ url: string }> {
  return requestData<{ url: string }>("/api/integrations/google/connect");
}

export function syncGoogleCalendar(): Promise<SyncResult> {
  return requestData<SyncResult>("/api/integrations/google/sync", { method: "POST" });
}

export function disconnectGoogleCalendar(): Promise<{ disconnected: boolean }> {
  return requestData("/api/integrations/google/disconnect", { method: "POST" });
}

export interface ClassroomStatus {
  available: boolean;
  connected: boolean;
  needsReconnect: boolean;
}

export function getClassroomStatus(): Promise<ClassroomStatus> {
  return requestData<ClassroomStatus>("/api/integrations/google/classroom/status");
}
