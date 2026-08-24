import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, MousePointerClick, Route, ShieldCheck, Target, UserRoundCog } from "lucide-react";
import { ErpPageShell, KpiGrid, SectionCard, StatusBanner } from "../../components/erp/ErpPrimitives";
import { StatusBadge } from "../../components/ui/Badges";

import {
  getLmsUnifiedInsights,
  recordLmsTrackerRecommendationEvent,
  type UnifiedInsights as UnifiedInsightsModel,
} from "../../lib/lms/index";
import {
  getPlatformRecommendations,
  getUnifiedProfile,
  recordPlatformRecommendationFeedback,
  type PlatformRecommendation,
  type UnifiedProfile,
} from "../../lib/career/profileApi";

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function ScoreBar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--comp-surface-hover)]">
      <div className="h-full rounded-full bg-[var(--comp-accent)]" style={{ width: `${width}%` }} />
    </div>
  );
}

export default function UnifiedInsights() {
  const [feedbackStatus, setFeedbackStatus] = useState("");

  const insightsQuery = useQuery({
    queryKey: ["lms", "unified-insights-page"],
    queryFn: () => getLmsUnifiedInsights(),
    staleTime: 30_000,
  });
  const profileQuery = useQuery({
    queryKey: ["career", "unified-profile"],
    queryFn: () => getUnifiedProfile(),
    staleTime: 60_000,
  });
  const recommendationsQuery = useQuery({
    queryKey: ["lms", "platform-recommendations", "home"],
    queryFn: () => getPlatformRecommendations("home"),
    staleTime: 30_000,
  });

  // Primary source only: profile/recommendations degrade silently.
  const error = insightsQuery.isError
    ? insightsQuery.error instanceof Error
      ? insightsQuery.error.message
      : "Failed to load unified insights."
    : "";
  const insights = insightsQuery.data ?? null;
  const profile = profileQuery.data ?? null;
  const platformRecommendations = recommendationsQuery.data?.items || [];
  const loading =
    insightsQuery.isPending || profileQuery.isPending || recommendationsQuery.isPending;

  const kpis = useMemo(() => {
    if (!insights) return [];
    return [
      { label: "ATS Score", value: `${Math.round(insights.atsScore.score)}%` },
      { label: "Next Skills", value: String(insights.nextSkills.length) },
      { label: "Eligible Matches", value: String(insights.opportunityRecommendations.length) },
      { label: "Explainability", value: pct(insights.qualityMonitoring.metrics.explainabilityCoverage) },
      ...(profile?.career?.completeness !== undefined
        ? [{ label: "Profile Quality", value: `${Math.round(profile.career.completeness)}%` }]
        : []),
    ];
  }, [insights, profile]);

  async function recordFeedback(recommendation: { id: string; title: string; confidence: number }, eventType: string) {
    setFeedbackStatus("");
    try {
      await recordLmsTrackerRecommendationEvent({
        eventType,
        sourceDomain: "unified_insights",
        recommendationId: recommendation.id,
        recommendationTitle: recommendation.title,
        confidence: recommendation.confidence,
        action: eventType,
      });
      setFeedbackStatus("Feedback saved. Future rankings can use this signal.");
    } catch (feedbackError) {
      setFeedbackStatus(feedbackError instanceof Error ? feedbackError.message : "Feedback could not be saved.");
    }
  }

  async function recordPlatformFeedback(recommendation: PlatformRecommendation, action: string) {
    setFeedbackStatus("");
    try {
      await recordPlatformRecommendationFeedback({
        impressionId: recommendation.impressionId,
        action,
        metadata: {
          domain: recommendation.domain,
          itemType: recommendation.itemType,
          itemId: recommendation.itemId,
        },
      });
      setFeedbackStatus("Platform feedback saved. Cross-domain rankings can use this signal.");
    } catch (feedbackError) {
      setFeedbackStatus(feedbackError instanceof Error ? feedbackError.message : "Feedback could not be saved.");
    }
  }

  return (
    <ErpPageShell
      title="Unified Insights"
      source="Internal API"
      isLoading={loading}
      loadingMessage="Scoring academic and career signals..."
    >
      {error ? <StatusBanner message={{ id: "unified-error", tone: "warning", text: error }} /> : null}
      {feedbackStatus ? <StatusBanner message={{ id: "unified-feedback", tone: "info", text: feedbackStatus }} /> : null}

      {insights ? (
        <>
          <KpiGrid items={kpis} />

          <SectionCard title="Platform Spine">
            <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
              <article className="rounded-xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">Unified profile</h3>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      LMS, Career, Events, skills, achievements, and privacy signals share one contract.
                    </p>
                  </div>
                  <StatusBadge preset={profile?.contractVersion === "unified-profile-v1" ? "success" : "warning"}>
                    {profile?.contractVersion || "not loaded"}
                  </StatusBadge>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg bg-[var(--background)] p-3">
                    <p className="text-xs text-[var(--text-secondary)]">Skills</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--comp-text-primary)]">{profile?.skills.length || 0}</p>
                  </div>
                  <div className="rounded-lg bg-[var(--background)] p-3">
                    <p className="text-xs text-[var(--text-secondary)]">Achievements</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--comp-text-primary)]">{profile?.achievements.length || 0}</p>
                  </div>
                  <div className="rounded-lg bg-[var(--background)] p-3">
                    <p className="text-xs text-[var(--text-secondary)]">Signals</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--comp-text-primary)]">{profile?.signals.length || 0}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                  {Object.entries(profile?.privacy || {}).slice(0, 6).map(([key, value]) => (
                    <span key={key} className="rounded-md border border-[var(--border)] px-2 py-1">
                      {key}: {String(value).replace("_", " ")}
                    </span>
                  ))}
                </div>
              </article>

              <div className="space-y-3">
                {platformRecommendations.slice(0, 3).map((recommendation) => (
                  <article key={recommendation.impressionId} className="rounded-xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">{recommendation.title}</h3>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          {recommendation.domain} · {recommendation.label} · {pct(recommendation.score)} match
                        </p>
                      </div>
                      <StatusBadge>{recommendation.itemType}</StatusBadge>
                    </div>
                    <ul className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
                      {recommendation.reasons.slice(0, 2).map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                    {recommendation.missing.length ? (
                      <p className="mt-2 text-xs text-[var(--warning)]">Close next: {recommendation.missing.join(", ")}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => recordPlatformFeedback(recommendation, "clicked")}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--comp-text-primary)] transition hover:bg-[var(--comp-surface-hover)]"
                    >
                      <UserRoundCog className="h-3.5 w-3.5" />
                      Use this signal
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Profile Graph">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {insights.profileGraph.nodes.map((node) => (
                <article key={node.id} className="rounded-xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">{node.label}</h3>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{node.value}</p>
                    </div>
                    <StatusBadge preset={node.status === "ready" ? "success" : node.status === "missing" ? "warning" : "neutral"}>
                      {node.status.replace("_", " ")}
                    </StatusBadge>
                  </div>
                  <p className="mt-3 text-xs text-[var(--text-secondary)]">Confidence {pct(node.confidence)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {node.inputsUsed.slice(0, 3).map((input) => (
                      <span key={input} className="rounded-md bg-[var(--background)] px-2 py-1 text-[11px] text-[var(--text-secondary)]">
                        {input}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {insights.profileGraph.edges.map((edge) => (
                <div key={`${edge.from}-${edge.to}`} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                  <span className="font-semibold text-[var(--comp-text-primary)]">{edge.from}</span> to{" "}
                  <span className="font-semibold text-[var(--comp-text-primary)]">{edge.to}</span>: {edge.signal}
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <SectionCard title="ATS Rubric">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-[var(--text-secondary)]">Resume score</p>
                    <p className="text-3xl font-semibold text-[var(--comp-text-primary)]">{Math.round(insights.atsScore.score)}%</p>
                  </div>
                  <StatusBadge preset={insights.atsScore.hasResume ? "success" : "warning"}>
                    {insights.atsScore.hasResume ? "resume attached" : "resume missing"}
                  </StatusBadge>
                </div>
              </div>
              <div className="space-y-3">
                {insights.atsScore.rubric.map((item) => (
                  <div key={item.label} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-[var(--comp-text-primary)]">{item.label}</span>
                      <span className="text-[var(--text-secondary)]">
                        {item.score}/{item.max}
                      </span>
                    </div>
                    <ScoreBar value={item.score} max={item.max} />
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">{item.reason}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Next Skill Demand">
              <div className="space-y-3">
                {insights.nextSkills.map((skill) => (
                  <article key={skill.id} className="rounded-xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">{skill.title}</h3>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {skill.opportunityDemand} active match{skill.opportunityDemand === 1 ? "" : "es"} need this skill
                        </p>
                      </div>
                      <StatusBadge>{pct(skill.confidence)} confidence</StatusBadge>
                    </div>
                    <ul className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
                      {skill.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => recordFeedback(skill, "clicked")}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--comp-text-primary)] transition hover:bg-[var(--comp-surface-hover)]"
                    >
                      <MousePointerClick className="h-3.5 w-3.5" />
                      Mark useful
                    </button>
                  </article>
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Eligible Opportunity Recommendations">
            <div className="grid gap-3 lg:grid-cols-2">
              {insights.opportunityRecommendations.map((opportunity) => (
                <article key={opportunity.id} className="rounded-xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">{opportunity.title}</h3>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {opportunity.organization || opportunity.type} · deadline {opportunity.deadline || "not listed"}
                      </p>
                    </div>
                    <StatusBadge preset="success">
                      <ShieldCheck className="mr-1 inline h-3 w-3" />
                      eligible
                    </StatusBadge>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-[var(--text-secondary)] sm:grid-cols-2">
                    <p>Matched: {opportunity.matchedSkills.join(", ") || "profile signals"}</p>
                    <p>Close gaps: {opportunity.missingSkills.join(", ") || "none detected"}</p>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
                    {opportunity.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => recordFeedback(opportunity, "clicked")}
                      className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--comp-text-primary)] transition hover:bg-[var(--comp-surface-hover)]"
                    >
                      <MousePointerClick className="h-3.5 w-3.5" />
                      Viewed
                    </button>
                    <button
                      type="button"
                      onClick={() => recordFeedback(opportunity, "applied")}
                      className="inline-flex items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--success)_35%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--success)] transition hover:bg-[color-mix(in_srgb,var(--success)_8%,transparent)]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Applied
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <SectionCard title="Unified Action Plan">
              <div className="space-y-3">
                {insights.actionPlan.map((action) => (
                  <article key={action.id} className="rounded-xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">{action.title}</h3>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">{action.description}</p>
                      </div>
                      <StatusBadge preset={action.priority === "high" ? "warning" : "neutral"}>
                        {action.domain} · {action.priority}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      Why: {action.reasons[0] || "Derived from profile graph signals."}
                    </p>
                  </article>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Quality Monitoring">
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                {insights.qualityMonitoring.dashboardCards.map((card) => (
                  <div key={card.label} className="rounded-xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
                    <p className="text-xs text-[var(--text-secondary)]">{card.label}</p>
                    <p className="mt-1 text-xl font-semibold text-[var(--comp-text-primary)]">{card.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--comp-text-primary)]">
                  <Target className="h-4 w-4 text-[var(--comp-accent)]" />
                  Offline baseline
                </div>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {insights.qualityMonitoring.baseline} · {insights.qualityMonitoring.measuredLatencyMs}ms measured response
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--comp-text-primary)]">
                  <Route className="h-4 w-4 text-[var(--comp-accent)]" />
                  Feedback loop
                </div>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{insights.feedbackLoop.modelInfluence}</p>
                <div className="mt-3 space-y-2">
                  {insights.feedbackLoop.recentEvents.slice(0, 3).map((event) => (
                    <div key={event.id} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                      {event.eventType} · {event.recommendationTitle}
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </div>
        </>
      ) : null}
    </ErpPageShell>
  );
}
