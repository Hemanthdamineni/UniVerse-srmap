import { SectionCard } from "../../../components/erp/ErpPrimitives";
import { EmptyView } from "../../../components/ui/Feedback";
import { ActionButton, PriorityBadge, SkillPill } from "./controls";
import type { UnifiedData, QuickAction } from "./types";

export function ActionTab({
  unified,
  onQuickAction,
}: {
  unified: UnifiedData | null;
  onQuickAction: QuickAction;
}) {
  if (!unified) {
    return (
      <div className="space-y-6">
        <SectionCard title="Priority Actions">
          <EmptyView
            title="Loading unified insights..."
            description="Actionable recommendations will appear here once data is processed."
          />
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Priority Actions */}
      {unified.actionPlan && unified.actionPlan.length > 0 && (
        <SectionCard title="Priority Actions">
          <div className="space-y-3">
            {unified.actionPlan.map((action, i) => (
              <div key={action.id || i} className="flex flex-col gap-2 rounded-xl border border-[var(--comp-border)] p-4 hover:bg-[var(--comp-surface-hover)] transition-colors">
                <div className="flex justify-between items-start">
                  <h4 className="font-semibold text-sm" style={{ color: "var(--comp-text-primary)" }}>
                    {action.title}
                  </h4>
                  <PriorityBadge priority={action.priority} />
                </div>
                <p className="text-xs" style={{ color: "var(--comp-text-secondary)" }}>{action.description}</p>
                {action.reasons && action.reasons.length > 0 && (
                  <p className="text-xs" style={{ color: "var(--comp-text-muted)" }}>
                    Why: {action.reasons.join("; ")}
                  </p>
                )}
                <div className="flex gap-2">
                  {action.domain === "academic" && (
                    <ActionButton
                      label="View Attendance"
                      variant="outline"
                      className="text-xs py-1 px-2"
                      onClick={() => onQuickAction("/academic/attendance-details")}
                    />
                  )}
                  {action.domain === "career" && (
                    <>
                      <ActionButton
                        label="View Opportunities"
                        variant="outline"
                        className="text-xs py-1 px-2"
                        onClick={() => onQuickAction("/career/opportunities")}
                      />
                      <ActionButton
                        label="Update Profile"
                        variant="ghost"
                        className="text-xs py-1 px-2"
                        onClick={() => onQuickAction("/career/me/profile")}
                      />
                    </>
                  )}
                  {action.domain === "skill" && (
                    <ActionButton
                      label="Browse Learning Materials"
                      variant="outline"
                      className="text-xs py-1 px-2"
                      onClick={() => onQuickAction("/resources/learning-materials")}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Skills to Develop */}
      {unified.nextSkills && unified.nextSkills.length > 0 && (
        <SectionCard title="Skills to Develop">
          <p className="text-sm" style={{ color: "var(--comp-text-secondary)" }}>
            Based on opportunity demand and your current profile. Click a skill to find learning resources.
          </p>
          <div className="flex flex-wrap gap-2">
            {unified.nextSkills.slice(0, 8).map((skill) => (
              <SkillPill
                key={skill.id}
                skill={skill.title}
                demand={skill.opportunityDemand}
                gapLevel={skill.gapLevel}
                onClick={() => onQuickAction("/resources/learning-materials")}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Recommended Opportunities */}
      {unified.opportunityRecommendations && unified.opportunityRecommendations.length > 0 && (
        <SectionCard title="Recommended Opportunities">
          <div className="space-y-2">
            {unified.opportunityRecommendations.slice(0, 5).map((opp) => (
              <div key={opp.id} className="rounded-lg border border-[var(--comp-border)] p-3 hover:bg-[var(--comp-surface-hover)] transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm" style={{ color: "var(--comp-text-primary)" }}>{opp.title}</p>
                      <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{
                        background: "color-mix(in srgb, var(--comp-accent) 15%, transparent)", color: "var(--comp-accent)"
                      }}>
                        {opp.type}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--comp-text-muted)" }}>{opp.organization}</p>
                    {opp.deadline && (
                      <p className="text-xs" style={{ color: "var(--warning)" }}>
                        Deadline: {new Date(opp.deadline).toLocaleDateString()}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {opp.matchedSkills.slice(0, 3).map((s, i) => (
                        <span key={i} className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "color-mix(in srgb, var(--success) 15%, transparent)", color: "var(--success)" }}>
                          {s}
                        </span>
                      ))}
                      {opp.missingSkills.slice(0, 2).map((s, i) => (
                        <span key={i} className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "color-mix(in srgb, var(--error) 15%, transparent)", color: "var(--error)" }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 text-right">
                    <span className="text-xs font-medium" style={{
                      color: opp.confidence >= 0.8 ? "var(--success)" : opp.confidence >= 0.6 ? "var(--warning)" : "var(--error)"
                    }}>
                      {Math.round(opp.confidence * 100)}% match
                    </span>
                    <p className="text-xs" style={{ color: "var(--comp-text-muted)" }}>
                      {opp.eligibility?.eligible ? "Eligible" : "Check eligibility"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {unified.opportunityRecommendations.length > 5 && (
              <ActionButton
                label={`View all ${unified.opportunityRecommendations.length} opportunities`}
                variant="ghost"
                onClick={() => onQuickAction("/career/opportunities")}
                className="mt-2"
              />
            )}
          </div>
        </SectionCard>
      )}

      {/* Career Readiness */}
      {unified.atsScore && (
        <SectionCard title="Career Readiness: ATS Resume Score">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4 text-center">
              <p className="text-sm" style={{ color: "var(--comp-text-secondary)" }}>ATS Score</p>
              <p className="text-4xl font-bold mt-1" style={{ color: unified.atsScore.score >= 70 ? "var(--success)" : unified.atsScore.score >= 50 ? "var(--warning)" : "var(--error)" }}>
                {unified.atsScore.score}%
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--comp-text-muted)" }}>
                {unified.atsScore.hasResume ? "Resume uploaded" : "No resume uploaded"}
              </p>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4 md:col-span-2">
              <p className="text-sm font-medium" style={{ color: "var(--comp-text-primary)" }}>Improvement Suggestions</p>
              <div className="space-y-2">
                {unified.atsScore.suggestions?.slice(0, 3).map((suggestion, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm" style={{ color: "var(--comp-text-secondary)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--comp-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {suggestion}
                  </div>
                ))}
              </div>
              <ActionButton
                label="Update Career Profile"
                variant="primary"
                onClick={() => onQuickAction("/career/me/profile")}
              />
            </div>
          </div>
        </SectionCard>
      )}

      {/* No actions state */}
      {(!unified.actionPlan || unified.actionPlan.length === 0) &&
        !unified.nextSkills?.length &&
        !unified.opportunityRecommendations?.length && (
        <SectionCard title="All Caught Up">
          <div className="rounded-xl p-6 text-center" style={{ background: "color-mix(in srgb, var(--success) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--success) 20%, transparent)" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <h4 className="font-semibold" style={{ color: "var(--success)" }}>No urgent actions needed</h4>
            <p className="text-sm mt-1" style={{ color: "var(--comp-text-secondary)" }}>
              You're on track! Check back later for new opportunities and recommendations.
            </p>
            <div className="flex gap-2 justify-center mt-4">
              <ActionButton
                label="Browse Opportunities"
                variant="outline"
                onClick={() => onQuickAction("/career/opportunities")}
              />
              <ActionButton
                label="Learning Materials"
                variant="ghost"
                onClick={() => onQuickAction("/resources/learning-materials")}
              />
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
