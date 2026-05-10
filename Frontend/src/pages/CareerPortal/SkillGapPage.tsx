// Skill gap: PageHeader, SectionCard, Tag-style tokens, SkeletonCard loading; listSkillGaps unchanged.
import React, { useEffect, useState } from "react";
import { listSkillGaps, type SkillGap } from "../../lib/careerApi";
import { Award, Zap, TrendingUp, BookOpen, ChevronRight, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { PageContainer } from "../../components/layout/PageLayouts";
import { SectionCard } from "../../components/ui/SectionCard";
import { SkeletonCard } from "../../components/ui/SkeletonCard";
import { Tag } from "../../components/ui/Tag";

const SkillGapPage: React.FC = () => {
  const [gaps, setGaps] = useState<SkillGap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchGaps();
  }, []);

  const fetchGaps = async () => {
    try {
      const data = await listSkillGaps();
      setGaps(data.items);
    } catch (err) {
      console.error("Failed to fetch skill gaps", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageContainer className="max-w-4xl space-y-4">
        <SkeletonCard className="h-20" />
        <SkeletonCard className="h-72" />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-4xl space-y-6">
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
              {gaps.map((gap) => (
                <div key={gap.skill} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="card-title font-semibold capitalize">{gap.skill}</p>
                    <p className="body-text flex items-center gap-1 text-sm">
                      <Search className="h-3 w-3" /> Required in {gap.opportunityCount} active opportunities
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/career/opportunities?query=${encodeURIComponent(gap.skill)}`}
                      className="btn-ghost rounded-lg px-3 py-2 text-xs no-underline"
                    >
                      View jobs
                    </Link>
                    <Link
                      to="/resources/learning-materials"
                      className="btn-primary rounded-lg px-3 py-2 text-xs no-underline"
                    >
                      <BookOpen className="mr-1 inline h-3 w-3" />
                      Learn
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="body-text text-sm italic">
              No major skill gaps identified. You are well matched for current opportunities.
            </p>
          )}
        </SectionCard>

        <div className="space-y-4">
          <SectionCard
            title="Career growth"
            className="border-[var(--comp-accent)] bg-[color-mix(in_srgb,var(--comp-accent)_8%,var(--comp-surface))]"
          >
            <p className="body-text text-sm">
              Closing one high-impact skill often opens multiple roles. Pair learning with applications you have saved.
            </p>
            <Link to="/career/opportunities" className="btn-primary mt-4 inline-flex w-full justify-center rounded-lg py-2 text-sm no-underline">
              Browse opportunities
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </SectionCard>

          <SectionCard title="Signals">
            <ul className="body-text space-y-3 text-sm">
              <li className="flex gap-2">
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
                Track how often a skill appears in new postings weekly.
              </li>
              <li className="flex gap-2">
                <Award className="mt-0.5 h-4 w-4 shrink-0 text-[var(--info)]" />
                Prioritize skills that overlap with your program electives.
              </li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Tag>Technical</Tag>
              <Tag variant="info">Internships</Tag>
            </div>
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
};

export default SkillGapPage;
