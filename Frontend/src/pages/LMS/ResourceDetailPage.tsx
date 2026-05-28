import {
  useEffect,
  useMemo,
  useState,
  Link,
  useNavigate,
  useParams,
  useSearchParams,
  SectionCard,
  InlineError,
  StatCard,
  AnnotationPanel,
  DuplicateWarning,
  ExamFeedbackCard,
  InteractiveFlashcardDeck,
  GuideSection,
  OutdatedWarning,
  QuizRunner,
  RecommendationSection,
  RequestCard,
  ResourceFilterPanel,
  ResourceGrid,
  RoadmapGraph,
  TopicMasteryHeatmap,
  WeeklyLeaderboard,
  addRoadmapNode,
  buildQuizFromQuestionBank,
  checkLmsDuplicate,
  completeRoadmapNode,
  createGuide,
  createLmsCollection,
  createLmsRequest,
  createLmsResource,
  deleteGuide,
  deleteLmsResource,
  createQuestionBankItem,
  createRoadmap,
  deleteLmsAnnotation,
  deleteRoadmap,
  flagLmsResource,
  generateLearningSession,
  getContinueLearning,
  getContributorProfile,
  getExploreData,
  getGuide,
  getLmsAnnotations,
  getLmsMastery,
  getLmsProgress,
  getLmsResource,
  getLmsStreak,
  getMyBookmarks,
  getMyContributions,
  getPendingExamFeedback,
  getPyqBank,
  getRecommendations,
  getRevisionQueue,
  getRoadmap,
  getSubjectOverview,
  getWeeklyLeaderboard,
  listGuides,
  listLmsCollections,
  listLmsRequests,
  listLmsResources,
  listQuestionBank,
  listRoadmaps,
  markGuideSectionRead,
  markLmsResourceOutdated,
  postLmsComment,
  rateLmsResource,
  recordLmsResourceView,
  saveLmsAnnotation,
  submitExamFeedback,
  submitQuizAttempt,
  submitRevisionReview,
  toggleGuideUpvote,
  toggleResourceBookmark,
  toggleResourceUpvote,
  updateGuide,
  updateLmsResource,
  upvoteLmsRequest,
  upvoteQuestionBankItem,
  useSession,
  isProfileAdmin,
  getProfileRegisterNo,
  createEmptyResourceForm,
  resourceToForm,
  buildResourcePayload,
  useAsyncPage,
  LmsFrame,
  renderResourceBody
} from "./_shared/LmsPageShared";
import type {
  LmsGuide,
  LmsRequest,
  LmsResource,
  LmsRoadmap,
  ResourceFilterState,
  ResourceFormState
} from "./_shared/LmsPageShared";

export function ResourceDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { profile } = useSession();
  const resourceState = useAsyncPage(() => getLmsResource(id), [id]);
  const [comment, setComment] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (id) {
      void recordLmsResourceView(id, {});
    }
  }, [id]);

  const resource = resourceState.data;
  const registerNo = getProfileRegisterNo(profile);
  const canManageResource = Boolean(
    resource && (String(resource.uploadedBy || "").toUpperCase() === registerNo || isProfileAdmin(profile))
  );

  return (
    <LmsFrame title={resource?.title || "Resource"} loading={resourceState.loading} error={resourceState.error}>
      {resource ? (
        <>
          <SectionCard title="Overview">
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                {resource.subjectCode} • {resource.subjectName} • {resource.unit}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">{resource.description}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--comp-text-muted)]">
                <span>Uploaded by {resource.uploadedBy}</span>
                {resource.updatedAt ? <span>Updated {new Date(resource.updatedAt).toLocaleDateString()}</span> : null}
              </div>
              {resource.publisher ? (
                <div className="grid gap-3 rounded-lg border border-[var(--comp-border)] bg-[color-mix(in_srgb,var(--comp-accent)_4%,transparent)] p-3 md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Publisher</p>
                    <Link
                      to={`/resources/contributors/${encodeURIComponent(resource.publisher.userId)}`}
                      className="text-sm font-semibold text-[var(--comp-text-primary)] no-underline hover:text-[var(--info)]"
                    >
                      {resource.publisher.displayName}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {resource.publisher.approvedCount}/{resource.publisher.contributionCount} approved resources, {resource.publisher.flaggedCount} flagged.
                    </p>
                  </div>
                  <div className="min-w-28 rounded-lg bg-[var(--comp-surface)] px-3 py-2 text-sm font-semibold text-[var(--comp-text-primary)]">
                    Trust {resource.publisher.trustScore}
                  </div>
                </div>
              ) : null}
              {resource.moderation ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <span className="rounded-full bg-[var(--comp-surface)] px-2 py-1">{resource.moderation.label}</span>
                  <span>{resource.moderation.flagCount} open reports</span>
                  <span>{resource.moderation.recommendationEligible ? "Recommendation eligible" : "Held from recommendations"}</span>
                </div>
              ) : null}
              {actionError ? <InlineError message={actionError} /> : null}
              <div className="flex flex-wrap gap-2">
                <button className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white" onClick={() => void toggleResourceUpvote(resource.id).then(() => resourceState.setData && getLmsResource(id).then(resourceState.setData))}>
                  {resource.userUpvoted ? "Remove upvote" : "Upvote"}
                </button>
                <button className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_15%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-primary)]" onClick={() => void toggleResourceBookmark(resource.id).then(() => resourceState.setData && getLmsResource(id).then(resourceState.setData))}>
                  {resource.userBookmarked ? "Saved" : "Save"}
                </button>
                <button className="rounded-full border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--warning)]" onClick={() => void markLmsResourceOutdated(resource.id, "Marked by learner").then(() => resourceState.setData && getLmsResource(id).then(resourceState.setData))}>
                  Mark outdated
                </button>
                <button className="rounded-full border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--error)]" onClick={() => {
                  const reason = window.prompt("Brief reason for reporting this resource");
                  if (!reason?.trim()) return;
                  void flagLmsResource(resource.id, reason.trim()).then(() => resourceState.setData && getLmsResource(id).then(resourceState.setData));
                }}>
                  Flag
                </button>
                <button className="rounded-full border border-[color-mix(in_srgb,var(--info)_25%,transparent)] bg-[color-mix(in_srgb,var(--info)_10%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-primary)]" onClick={() => void rateLmsResource(resource.id, { rating: 5, dimensionTags: ["Exam useful"] }).then(() => resourceState.setData && getLmsResource(id).then(resourceState.setData))}>
                  Quick rate 5
                </button>
                {canManageResource ? (
                  <>
                    <Link className="rounded-full border border-[var(--comp-border)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-primary)] no-underline" to={`/resources/add?edit=${encodeURIComponent(resource.id)}`}>
                      Edit
                    </Link>
                    <button
                      className="rounded-full border border-[color-mix(in_srgb,var(--error)_28%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--error)]"
                      onClick={async () => {
                        if (!window.confirm("Delete this resource?")) return;
                        setActionError("");
                        try {
                          await deleteLmsResource(resource.id);
                          navigate("/resources/me/contributions");
                        } catch (err) {
                          setActionError(err instanceof Error ? err.message : "Unable to delete this resource.");
                        }
                      }}
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
              <OutdatedWarning isOutdated={resource.isOutdated} />
            </div>
          </SectionCard>

          <SectionCard title="Preview">{renderResourceBody(resource)}</SectionCard>

          <AnnotationPanel
            annotations={resource.annotations || []}
            onSave={async (content) => {
              const next = await saveLmsAnnotation(resource.id, content);
              resourceState.setData?.({ ...resource, annotations: next });
            }}
            onDelete={async (annotationId) => {
              await deleteLmsAnnotation(annotationId);
              const next = await getLmsAnnotations(resource.id);
              resourceState.setData?.({ ...resource, annotations: next });
            }}
          />

          <SectionCard title="Comments">
            <div className="space-y-3">
              {(resource.comments || []).map((entry) => (
                <div key={entry.id} className="rounded-2xl bg-[var(--comp-surface)] px-4 py-3">
                  <p className="text-sm text-[var(--comp-text-primary)]">{entry.content}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{entry.userId}</p>
                </div>
              ))}
              <div className="flex gap-3">
                <input className="flex-1 lms-input" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment" aria-label="Add a comment" />
                <button
                  className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white"
                  onClick={async () => {
                    const next = await postLmsComment(resource.id, comment);
                    setComment("");
                    resourceState.setData?.({ ...resource, comments: next });
                  }}
                >
                  Post
                </button>
              </div>
            </div>
          </SectionCard>

          <RecommendationSection title="Related Resources" items={resource.related || []} />
        </>
      ) : null}
    </LmsFrame>
  );
}

export default ResourceDetailPage;

