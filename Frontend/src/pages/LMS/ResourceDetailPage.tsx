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
import { LazyMarkdown as Markdown } from "../../components/markdown";
import { ConfirmDialog } from "../../components/dialog";
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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

  async function handleDeleteConfirmed() {
    if (!resource) return;
    setConfirmingDelete(false);
    setActionError("");
    try {
      await deleteLmsResource(resource.id);
      navigate("/resources/me/contributions");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't delete this resource. Please try again.");
    }
  }

  return (
    <LmsFrame title={resource?.title || "Resource"} loading={resourceState.loading} error={resourceState.error}>
      {resource ? (
        <>
          <SectionCard title="Overview">
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                {resource.subjectCode} • {resource.subjectName} • {resource.unit}
              </p>
              <Markdown className="text-sm">{resource.description ?? ""}</Markdown>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--comp-text-muted)]">
                <span>Uploaded by {resource.uploadedBy}</span>
                {resource.updatedAt ? <span>Updated {new Date(resource.updatedAt).toLocaleDateString()}</span> : null}
              </div>
              {resource.publisher ? (
                <div className="space-y-1 border-t border-[var(--comp-border)] pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Publisher</p>
                  <Link
                    to={`/resources/contributors/${encodeURIComponent(resource.publisher.userId)}`}
                    className="text-sm font-semibold text-[var(--comp-text-primary)] no-underline hover:text-[var(--info)]"
                  >
                    {resource.publisher.displayName}
                  </Link>
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
                <button className="lms-btn lms-btn-primary" onClick={() => void toggleResourceUpvote(resource.id).then(() => resourceState.setData && getLmsResource(id).then(resourceState.setData))}>
                  {resource.userUpvoted ? "Remove upvote" : "Upvote"}
                </button>
                <button className="lms-btn lms-btn-ghost" onClick={() => void toggleResourceBookmark(resource.id).then(() => resourceState.setData && getLmsResource(id).then(resourceState.setData))}>
                  {resource.userBookmarked ? "Saved" : "Save"}
                </button>
                <button className="lms-btn lms-btn-ghost border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]" onClick={() => void markLmsResourceOutdated(resource.id, "Marked by learner").then(() => resourceState.setData && getLmsResource(id).then(resourceState.setData))}>
                  Mark outdated
                </button>
                <button className="lms-btn lms-btn-danger" onClick={() => {
                  const reason = window.prompt("Brief reason for reporting this resource");
                  if (!reason?.trim()) return;
                  void flagLmsResource(resource.id, reason.trim()).then(() => resourceState.setData && getLmsResource(id).then(resourceState.setData));
                }}>
                  Flag
                </button>
                <button className="lms-btn lms-btn-ghost border-[color-mix(in_srgb,var(--info)_25%,transparent)] bg-[color-mix(in_srgb,var(--info)_10%,transparent)]" onClick={() => void rateLmsResource(resource.id, { rating: 5, dimensionTags: ["Exam useful"] }).then(() => resourceState.setData && getLmsResource(id).then(resourceState.setData))}>
                  Quick rate 5
                </button>
                {canManageResource ? (
                  <>
                    <Link className="lms-btn lms-btn-ghost no-underline" to={`/resources/add?edit=${encodeURIComponent(resource.id)}`}>
                      Edit
                    </Link>
                    <button
                      className="lms-btn lms-btn-danger"
                      onClick={() => setConfirmingDelete(true)}
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
              <div className="divide-y divide-[var(--comp-border)]">
                {(resource.comments || []).map((entry) => (
                  <div key={entry.id} className="py-3">
                    <Markdown className="text-sm">{entry.content}</Markdown>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{entry.userId}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <input className="flex-1 lms-input" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment" aria-label="Add a comment" />
                <button
                  className="lms-btn lms-btn-primary"
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

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this resource?"
        description="Students will no longer find it in search, filters, or collections. This cannot be undone."
        confirmLabel="Delete resource"
        danger
        onConfirm={() => void handleDeleteConfirmed()}
      />
    </LmsFrame>
  );
}

export default ResourceDetailPage;

