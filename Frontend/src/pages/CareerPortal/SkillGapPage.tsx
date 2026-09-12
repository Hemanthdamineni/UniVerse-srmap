// Skill gap: PageHeader, SectionCard, Tag-style tokens, SkeletonCard loading.
// Story 4.3 — every gap comes with a way to close it (resources, roadmap,
// jobs) plus an opt-in "learning plan" whose closure is tracked over time.
import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listSkillGaps,
  listLearningPlans,
  createLearningPlan,
  updateLearningPlan,
  deleteLearningPlan,
  type SkillGap,
  type LearningPlan,
} from "../../lib/career/careerApi";
import { careerKeys } from "../../lib/career/queryKeys";
import { Award, Zap, BookOpen, ChevronRight, Search, Map as MapIcon, Check, RotateCcw, X } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui/Layouts";
import { PageContainer } from "../../components/layout/PageLayouts";
import { SectionCard } from "../../components/ui/SectionCard";
import { SkeletonCard } from "../../components/ui/Skeletons";
import { InlineError } from "../../components/ui/Feedback";

const SkillGapPage: React.FC = () => {
  const [gaps, setGaps] = useState<SkillGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    void fetchGaps();
  }, []);

  const fetchGaps = async () => {
    try {
      const data = await listSkillGaps();
      setGaps(data.items);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch skill gaps";
      console.error(message, err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const { data: planData } = useQuery({
    queryKey: careerKeys.learningPlans,
    queryFn: listLearningPlans,
    staleTime: 30_000,
  });
  const plans = planData?.items ?? [];
  const stats = planData?.stats ?? { active: 0, closed: 0, closedThisMonth: 0 };
  const planFor = (skill: string) =>
    plans.find((p) => p.skill.toLowerCase() === skill.toLowerCase());

  const invalidatePlans = () => queryClient.invalidateQueries({ queryKey: careerKeys.learningPlans });
  const startPlan = useMutation({ mutationFn: (skill: string) => createLearningPlan(skill), onSuccess: invalidatePlans });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "closed" }) => updateLearningPlan(id, status),
    onSuccess: invalidatePlans,
  });
  const removePlan = useMutation({ mutationFn: (id: string) => deleteLearningPlan(id), onSuccess: invalidatePlans });

  if (loading) {
    return (
      <PageContainer className="space-y-4">
        <SkeletonCard className="h-20" />
        <SkeletonCard className="h-72" />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer className="space-y-4">
        <PageHeader
          title="Skill gap analysis"
          subtitle="Identify technical skills that unlock the most opportunities for you"
        />
        <InlineError title="Could not load skill gap analysis" message={error} onRetry={fetchGaps} />
      </PageContainer>
    );
  }

  const activePlans = plans.filter((p) => p.status === "active");
  const closedPlans = plans.filter((p) => p.status === "closed").slice(0, 6);

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Skill gap analysis"
        subtitle="Identify technical skills that unlock the most opportunities for you"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SectionCard title="High impact skills" className="md:col-span-2">
          <div className="mb-2 flex items-center gap-2">
            <Zap className="h-5 w-5 text-[var(--warning)]" />
            <span className="section-title">In-demand gaps</span>
          </div>
          <p className="body-text mb-4 text-sm">
            Skills you are missing that appear in the most active listings
          </p>
          {gaps.length > 0 ? (
            <div className="divide-y divide-[var(--comp-border)]">
              {gaps.map((gap) => {
                const plan = planFor(gap.skill);
                return (
                  <div key={gap.skill} className="flex flex-col gap-3 py-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="card-title font-semibold">{gap.skill}</p>
                        <p className="body-text flex items-center gap-1 text-sm">
                          <Search className="h-3 w-3" /> Required in {gap.opportunityCount} active opportunities
                        </p>
                      </div>
                      {plan?.status === "active" ? (
                        <button
                          type="button"
                          onClick={() => setStatus.mutate({ id: plan.id, status: "closed" })}
                          className="btn-ghost inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs"
                        >
                          <Check className="h-3 w-3" /> Mark done
                        </button>
                      ) : plan?.status === "closed" ? (
                        <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--success)]">
                          <Check className="h-3.5 w-3.5" /> Acquired
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={startPlan.isPending}
                          onClick={() => startPlan.mutate(gap.skill)}
                          className="btn-primary inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs disabled:opacity-50"
                        >
                          Track this skill
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/career/opportunities?query=${encodeURIComponent(gap.skill)}`}
                        className="btn-ghost rounded-lg px-3 py-1.5 text-xs no-underline"
                      >
                        View jobs
                      </Link>
                      <Link
                        to={`/learn/roadmaps?q=${encodeURIComponent(gap.skill)}`}
                        className="btn-ghost inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs no-underline"
                      >
                        <MapIcon className="h-3 w-3" /> Roadmap
                      </Link>
                      <Link
                        to={`/learn/discover?q=${encodeURIComponent(gap.skill)}`}
                        className="btn-ghost inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs no-underline"
                      >
                        <BookOpen className="h-3 w-3" /> Resources
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="body-text text-sm italic">
              No major skill gaps identified. You are well matched for current opportunities.
            </p>
          )}
        </SectionCard>

        <div className="space-y-4">
          <SectionCard
            title="Your progress"
            className="border-[var(--comp-accent)] bg-[color-mix(in_srgb,var(--comp-accent)_8%,var(--comp-surface))]"
          >
            {plans.length === 0 ? (
              <p className="body-text text-sm text-[var(--comp-text-secondary)]">
                Not tracking any skills yet.
              </p>
            ) : (
              <div className="flex gap-4">
                <div>
                  <p className="text-2xl font-bold text-[var(--comp-text-primary)]">{stats.closed}</p>
                  <p className="body-text text-xs">acquired</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--comp-text-primary)]">{stats.active}</p>
                  <p className="body-text text-xs">in progress</p>
                </div>
              </div>
            )}
            {activePlans.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {activePlans.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-[var(--comp-text-primary)]">{p.skill}</span>
                    <button
                      type="button"
                      onClick={() => setStatus.mutate({ id: p.id, status: "closed" })}
                      className="inline-flex items-center gap-1 text-[var(--comp-accent)] hover:underline"
                    >
                      <Check className="h-3 w-3" /> done
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {closedPlans.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-[var(--comp-border)] pt-3">
                {closedPlans.map((p: LearningPlan) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-xs text-[var(--comp-text-secondary)]">
                    <span className="inline-flex items-center gap-1">
                      <Check className="h-3 w-3 text-[var(--success)]" />
                      <span>{p.skill}</span>
                      {p.closedReason === "acquired" ? " · now on your profile" : ""}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setStatus.mutate({ id: p.id, status: "active" })}
                        className="text-[var(--comp-text-muted)] hover:text-[var(--comp-accent)]"
                        aria-label={`Reopen ${p.skill}`}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removePlan.mutate(p.id)}
                        className="text-[var(--comp-text-muted)] hover:text-[var(--error)]"
                        aria-label={`Remove ${p.skill} from your progress`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {plans.length === 0 && (
              <p className="body-text mt-3 text-xs">
                Hit <strong>Track this skill</strong> on any gap to start following it. It moves to
                "acquired" automatically once the skill lands on your profile.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Tips">
            <ul className="body-text space-y-3 text-sm">
              <li className="flex gap-2">
                <Award className="mt-0.5 h-4 w-4 shrink-0 text-[var(--info)]" />
                Closing one high-impact skill often opens multiple roles. Pair learning with saved
                applications.
              </li>
            </ul>
            <Link
              to="/career/opportunities"
              className="btn-primary mt-4 inline-flex w-full justify-center rounded-lg py-2 text-sm no-underline"
            >
              Browse opportunities
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
};

export default SkillGapPage;
