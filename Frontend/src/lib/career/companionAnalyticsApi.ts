import { requestData } from "../core/apiClient";

export type CompanionAnalyticsEvent = {
  id: string;
  eventName: string;
  category: string;
  userId?: string | null;
  role?: string | null;
  route?: string | null;
  properties: Record<string, unknown>;
  occurredAt: string;
  receivedAt: string;
};

export type CompanionAnalyticsReport = {
  contractVersion: "companion-analytics-report-v1";
  windowDays: number;
  generatedAt: string;
  totals: {
    totalEvents: number;
    activeActors: number;
    sessions: number;
    firstEventAt: string | null;
    lastEventAt: string | null;
  };
  recommendationCtr: {
    impressions: number;
    clicks: number;
    rate: number;
  };
  byCategory: Array<{ category: string; count: number }>;
  topEvents: Array<{ eventName: string; category: string; count: number; actors: number }>;
  funnel: Array<{ eventName: string; count: number }>;
  recent: CompanionAnalyticsEvent[];
};

export async function getCompanionAnalyticsReport(params: { days?: number; limit?: number } = {}) {
  const search = new URLSearchParams();
  if (params.days) search.set("days", String(params.days));
  if (params.limit) search.set("limit", String(params.limit));
  return requestData<CompanionAnalyticsReport>(
    `/api/analytics/companion/report${search.toString() ? `?${search.toString()}` : ""}`
  );
}
