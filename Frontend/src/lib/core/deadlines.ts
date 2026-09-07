/**
 * deadlines.ts — the unified deadline timeline (Batch B12 / T6.6.3):
 * Classroom coursework (when connected) + saved-opportunity deadlines +
 * registered events + academic-calendar milestones, one sorted list.
 */

import { requestData } from "./apiClient";

export type DeadlineSource =
  | "classroom"
  | "opportunity"
  | "event"
  | "academic-calendar";

export interface DeadlineItem {
  id: string;
  title: string;
  dueAt: string;
  link: string | null;
  source: DeadlineSource;
  meta?: { course?: string; state?: string };
}

export interface DeadlineTimeline {
  generatedAt: string;
  items: DeadlineItem[];
  sources: Record<string, "ok" | "unavailable" | "error">;
}

export function getDeadlines(params: { horizonDays?: number; includePast?: boolean } = {}): Promise<DeadlineTimeline> {
  const qs = new URLSearchParams();
  if (params.horizonDays) qs.set("horizonDays", String(params.horizonDays));
  if (params.includePast) qs.set("includePast", "1");
  return requestData<DeadlineTimeline>(`/api/deadlines${qs.toString() ? `?${qs}` : ""}`);
}

const SOURCE_LABEL: Record<DeadlineSource, string> = {
  classroom: "Classroom",
  opportunity: "Opportunity",
  event: "Event",
  "academic-calendar": "Calendar",
};

export function sourceLabel(s: DeadlineSource): string {
  return SOURCE_LABEL[s] ?? s;
}

/** "in 3 days" / "tomorrow" / "today" / "2 days ago" */
export function relativeDue(iso: string, now = Date.now()): string {
  const days = Math.round((Date.parse(iso) - now) / 86_400_000);
  if (Number.isNaN(days)) return "";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}
