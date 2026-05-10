import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
// LMS shell: InlineError in frame; StatCard momentum row; resource preview uses comp-surface tokens.
import { ErpPageShell, SectionCard } from "../../components/erp/ErpPrimitives";
import { InlineError } from "../../components/ui/InlineError";
import { StatCard } from "../../components/ui/StatCard";
import AnnotationPanel from "../../components/lms/AnnotationPanel";
import DuplicateWarning from "../../components/lms/DuplicateWarning";
import ExamFeedbackCard from "../../components/lms/ExamFeedbackCard";
import FlipCard from "../../components/lms/FlipCard";
import GuideSection from "../../components/lms/GuideSection";
import OutdatedWarning from "../../components/lms/OutdatedWarning";
import QuizRunner from "../../components/lms/QuizRunner";
import RecommendationSection from "../../components/lms/RecommendationSection";
import RequestCard from "../../components/lms/RequestCard";
import ResourceFilterPanel, { type ResourceFilterState } from "../../components/lms/ResourceFilterPanel";
import ResourceGrid from "../../components/lms/ResourceGrid";
import RoadmapGraph from "../../components/lms/RoadmapGraph";
import TopicMasteryHeatmap from "../../components/lms/TopicMasteryHeatmap";
import WeeklyLeaderboard from "../../components/lms/WeeklyLeaderboard";
import {
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
  type LmsGuide,
  type LmsRequest,
  type LmsResource,
  type LmsRoadmap,
} from "../../lib/lmsApi";
import { useSession } from "../../hooks/useSession";

const ADMIN_REGISTER_NO = "AP23110010419";

type ResourceFormState = {
  type: string;
  title: string;
  description: string;
  semester: string;
  subjectCode: string;
  subjectName: string;
  unit: string;
  url: string;
  noteContent: string;
  difficulty: string;
  tags: string;
  examYear: string;
  examType: string;
  examMonth: string;
  file: File | null;
};

function getProfileRegisterNo(profile: Record<string, unknown> | null | undefined) {
  const table =
    profile && typeof profile.TableContent === "object" && profile.TableContent
      ? (profile.TableContent as Record<string, unknown>)
      : null;

  return String(table?.["Register No."] || profile?.regNo || profile?.registerNo || "").trim().toUpperCase();
}

function createEmptyResourceForm(): ResourceFormState {
  return {
    type: "note",
    title: "",
    description: "",
    semester: "",
    subjectCode: "",
    subjectName: "",
    unit: "",
    url: "",
    noteContent: "",
    difficulty: "intermediate",
    tags: "",
    examYear: "",
    examType: "",
    examMonth: "",
    file: null,
  };
}

function resourceToForm(resource: LmsResource): ResourceFormState {
  return {
    type: resource.type || "note",
    title: resource.title || "",
    description: resource.description || "",
    semester: resource.semester || "",
    subjectCode: resource.subjectCode || "",
    subjectName: resource.subjectName || "",
    unit: resource.unit || "",
    url: resource.url || "",
    noteContent: resource.noteContent || "",
    difficulty: resource.difficulty || "intermediate",
    tags: Array.isArray(resource.tags) ? resource.tags.join(", ") : "",
    examYear: resource.examYear || "",
    examType: resource.examType || "",
    examMonth: resource.examMonth || "",
    file: null,
  };
}

function buildResourcePayload(form: ResourceFormState) {
  return {
    ...form,
    subjectCode: form.subjectCode.trim().toUpperCase(),
    tags: form.tags.split(",").map((item) => item.trim()).filter(Boolean),
    file: form.file || undefined,
  };
}

function useAsyncPage<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loader()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Request failed");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, deps);

  return { data, setData, loading, error };
}

function LmsFrame({
  title,
  loading,
  error,
  children,
}: {
  title: string;
  loading?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <ErpPageShell title={title} source="Internal API" isLoading={loading} loadingMessage={`Loading ${title}...`}>
      {error ? <InlineError message={error} className="mb-4" /> : null}
      <div className="space-y-5">{children}</div>
    </ErpPageShell>
  );
}

function renderResourceBody(resource: LmsResource) {
  if (resource.renderType === "youtube" && resource.url) {
    const embed = resource.url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/");
    return <iframe className="h-[420px] w-full rounded-2xl border-0" src={embed} allowFullScreen title={resource.title} />;
  }
  if ((resource.renderType === "pdf-file" || resource.renderType === "pdf-link" || resource.type === "pyq") && (resource.filePath || resource.url)) {
    const src = resource.filePath?.startsWith("/") ? resource.filePath : resource.filePath || resource.url || "";
    return (
      <iframe
        className="h-[min(640px,80vh)] w-full rounded-2xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] bg-[var(--comp-surface)]"
        src={src}
        title={resource.title}
      />
    );
  }
  if (resource.renderType === "note" || resource.type === "note") {
    return (
      <div className="body-text whitespace-pre-wrap rounded-2xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-5 leading-7">
        {resource.noteContent}
      </div>
    );
  }
  if (resource.url) {
    return (
      <a
        href={resource.url}
        target="_blank"
        rel="noreferrer"
        className="btn-primary rounded-full px-4 py-2 text-sm no-underline"
      >
        Open resource
      </a>
    );
  }
  if (resource.filePath) {
    return (
      <a
        href={resource.filePath}
        target="_blank"
        rel="noreferrer"
        className="btn-primary rounded-full px-4 py-2 text-sm no-underline"
      >
        Download file
      </a>
    );
  }
  return (
    <div className="body-text rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--comp-accent)_15%,transparent)] bg-[var(--comp-surface)] p-6 text-sm">
      No preview available.
    </div>
  );
}

export function LmsHomePage() {
  const recommendations = useAsyncPage(() => getRecommendations({ limit: 6 }), []);
  const continueLearning = useAsyncPage(() => getContinueLearning(), []);
  const revision = useAsyncPage(() => getRevisionQueue(), []);
  const pendingExam = useAsyncPage(() => getPendingExamFeedback(), []);
  const requests = useAsyncPage(() => listLmsRequests({ status: "open", limit: 5 }), []);
  const leaderboard = useAsyncPage(() => getWeeklyLeaderboard(), []);
  const streak = useAsyncPage(() => getLmsStreak(), []);

  return (
    <LmsFrame title="LMS Home" loading={recommendations.loading || continueLearning.loading} error={recommendations.error || continueLearning.error}>
      <SectionCard title="Momentum">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Current streak" value={String(streak.data?.currentStreak || 0)} />
          <StatCard label="Revision due" value={String(revision.data?.length || 0)} />
          <StatCard label="Exam feedback pending" value={String(pendingExam.data?.length || 0)} />
        </div>
      </SectionCard>

      {continueLearning.data ? (
        <SectionCard title="Continue Learning">
          <ResourceGrid items={[continueLearning.data]} />
        </SectionCard>
      ) : null}

      <RecommendationSection title="Recommended for you" items={recommendations.data || []} />

      <SectionCard title="Open Requests">
        <div className="space-y-3">
          {(requests.data?.items || []).map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      </SectionCard>

      <WeeklyLeaderboard items={leaderboard.data || []} />
    </LmsFrame>
  );
}

export function BrowsePage() {
  const [filters, setFilters] = useState<ResourceFilterState>({});
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useAsyncPage(
    () => listLmsResources({ ...filters, limit: 24, page: 1, sort: "quality" }),
    [filters.subjectCode, filters.type, filters.difficulty, filters.query, reloadKey]
  );

  return (
    <LmsFrame title="Browse Resources" loading={loading} error={error}>
      <ResourceFilterPanel filters={filters} onChange={setFilters} />
      <ResourceGrid items={data?.items || []} />
      <button
        className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white"
        onClick={() => setReloadKey((value) => value + 1)}
      >
        Refresh
      </button>
    </LmsFrame>
  );
}

export function ExplorePage() {
  const { data, loading, error } = useAsyncPage(() => getExploreData(), []);
  return (
    <LmsFrame title="Explore" loading={loading} error={error}>
      <RecommendationSection title="Trending" items={data?.trending || []} />
      <RecommendationSection title="Top Rated" items={data?.topRated || []} />
      <RecommendationSection title="Exam Ready" items={data?.examReady || []} />
    </LmsFrame>
  );
}

export function AddResourcePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit") || "";
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [duplicate, setDuplicate] = useState<{ exact?: { title: string } | null; similar?: unknown[] } | null>(null);
  const [form, setForm] = useState<ResourceFormState>(() => createEmptyResourceForm());
  const editState = useAsyncPage<LmsResource | null>(
    () => (editId ? getLmsResource(editId) : Promise.resolve(null)),
    [editId]
  );

  useEffect(() => {
    if (editState.data) {
      setForm(resourceToForm(editState.data));
    }
  }, [editState.data?.id]);

  const submitLabel = editId ? "Update resource" : "Create resource";
  const frameTitle = editId ? "Edit Resource" : "Add Resource";

  return (
    <LmsFrame title={frameTitle} loading={Boolean(editId && editState.loading)} error={editState.error}>
      <div className="dashboard-card grid gap-4 p-5">
        <DuplicateWarning exact={duplicate?.exact || null} similarCount={duplicate?.similar?.length || 0} />
        {formError ? <InlineError message={formError} /> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <select className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
            <option value="note">Note</option>
            <option value="link">Link</option>
            <option value="file">File</option>
            <option value="quiz">Quiz</option>
            <option value="flashcard">Flashcard</option>
            <option value="pyq">PYQ</option>
          </select>
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Semester" value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })} />
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Subject code" value={form.subjectCode} onChange={(event) => setForm({ ...form, subjectCode: event.target.value.toUpperCase() })} />
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Subject name" value={form.subjectName} onChange={(event) => setForm({ ...form, subjectName: event.target.value })} />
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Unit" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} />
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Difficulty" value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })} />
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Tags comma separated" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
        </div>
        <textarea className="min-h-24 rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        {form.type === "link" ? (
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="URL" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} />
        ) : null}
        {form.type === "note" ? (
          <textarea className="min-h-48 rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Note content" value={form.noteContent} onChange={(event) => setForm({ ...form, noteContent: event.target.value })} />
        ) : null}
        {(form.type === "file" || form.type === "pyq") ? (
          <input type="file" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })} />
        ) : null}
        <div className="flex gap-3">
          <button
            className="rounded-full bg-[var(--comp-accent)] px-5 py-2.5 text-sm font-semibold text-white"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setFormError("");
              try {
                if (!form.title.trim() || !form.subjectCode.trim() || !form.subjectName.trim()) {
                  setFormError("Title, subject code, and subject name are required.");
                  return;
                }

                const payload = buildResourcePayload(form);
                if (editId) {
                  const updated = await updateLmsResource(editId, payload);
                  navigate(`/resources/${updated.id}`);
                  return;
                }

                const duplicateResult = await checkLmsDuplicate({
                  title: form.title,
                  subjectCode: form.subjectCode,
                });
                setDuplicate(duplicateResult);
                const created = await createLmsResource(payload);
                navigate(`/resources/${created.id}`);
              } catch (err) {
                setFormError(err instanceof Error ? err.message : "Unable to save this resource.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving..." : submitLabel}
          </button>
          <button
            className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_15%,transparent)] px-5 py-2.5 text-sm font-semibold text-[var(--comp-text-primary)]"
            onClick={async () => {
              const next = await generateLearningSession(30);
              window.alert(`Suggested session time: ${String(next.totalEstimatedMinutes || 0)} min`);
            }}
          >
            Preview study fit
          </button>
        </div>
      </div>
    </LmsFrame>
  );
}

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
    resource && (String(resource.uploadedBy || "").toUpperCase() === registerNo || registerNo === ADMIN_REGISTER_NO)
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
                <button className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700" onClick={() => void flagLmsResource(resource.id, "User flag")}>
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
                <div key={entry.id} className="rounded-2xl bg-white/80 px-4 py-3">
                  <p className="text-sm text-[var(--comp-text-primary)]">{entry.content}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{entry.userId}</p>
                </div>
              ))}
              <div className="flex gap-3">
                <input className="flex-1 rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment" />
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

export function SubjectOverviewPage() {
  const { code = "" } = useParams();
  const { data, loading, error } = useAsyncPage(() => getSubjectOverview(code), [code]);
  const topByUnit = useMemo(() => ((data?.topByUnit as Array<Record<string, unknown>>) || []), [data]);
  const topicMastery = useMemo(() => ((data?.topicMastery as Array<Record<string, unknown>>) || []), [data]);

  return (
    <LmsFrame title={`Subject ${code}`} loading={loading} error={error}>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="dashboard-card p-4">
          <p className="text-sm text-[var(--text-secondary)]">Studying now</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">{String(data?.studyingCount || 0)}</p>
        </div>
        <div className="dashboard-card p-4">
          <p className="text-sm text-[var(--text-secondary)]">Units covered</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">{String(topByUnit.length)}</p>
        </div>
        <div className="dashboard-card p-4">
          <p className="text-sm text-[var(--text-secondary)]">Open requests</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">{String((data?.openRequests as unknown[] | undefined)?.length || 0)}</p>
        </div>
      </div>

      <SectionCard title="Top Resources by Unit">
        <div className="space-y-3">
          {topByUnit.map((entry) => (
            <Link key={String(entry.unitNormalized)} to={`/resources/${String((entry.topResource as Record<string, unknown>)?.id || "")}`} className="dashboard-card block p-4">
              <p className="text-sm font-semibold text-[var(--comp-text-primary)]">{String(entry.unit || entry.unitNormalized)}</p>
              <p className="text-sm text-[var(--text-secondary)]">{String((entry.topResource as Record<string, unknown>)?.title || "")}</p>
            </Link>
          ))}
        </div>
      </SectionCard>

      <TopicMasteryHeatmap
        items={topicMastery.map((entry) => ({
          label: String(entry.label || "Topic"),
          mastery: Number(entry.mastery || 0),
        }))}
      />
    </LmsFrame>
  );
}

export function PYQBankPage() {
  const { code = "" } = useParams();
  const { data, loading, error } = useAsyncPage(() => getPyqBank(code, { limit: 50, page: 1, sort: "recent" }), [code]);
  return (
    <LmsFrame title={`PYQ Bank • ${code}`} loading={loading} error={error}>
      <ResourceGrid items={data?.items || []} />
    </LmsFrame>
  );
}

export function RequestBoardPage() {
  const { data, setData, loading, error } = useAsyncPage(() => listLmsRequests({ status: "open", limit: 50, page: 1 }), []);
  const [title, setTitle] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [semester, setSemester] = useState("");
  const [description, setDescription] = useState("");

  return (
    <LmsFrame title="Request Board" loading={loading} error={error}>
      <SectionCard title="Post a Request">
        <div className="grid gap-3 md:grid-cols-2">
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Subject code" value={subjectCode} onChange={(event) => setSubjectCode(event.target.value)} />
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Subject name" value={subjectName} onChange={(event) => setSubjectName(event.target.value)} />
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Semester" value={semester} onChange={(event) => setSemester(event.target.value)} />
        </div>
        <textarea className="mt-3 min-h-24 w-full rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
        <button
          className="mt-3 rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white"
          onClick={async () => {
            await createLmsRequest({ title, subjectCode, subjectName, semester, description });
            const next = await listLmsRequests({ status: "open", limit: 50, page: 1 });
            setData(next);
            setTitle("");
            setDescription("");
          }}
        >
          Post request
        </button>
      </SectionCard>
      <div className="space-y-3">
        {(data?.items || []).map((request: LmsRequest) => (
          <RequestCard
            key={request.id}
            request={request}
            onUpvote={async (requestId) => {
              await upvoteLmsRequest(requestId);
              const next = await listLmsRequests({ status: "open", limit: 50, page: 1 });
              setData(next);
            }}
          />
        ))}
      </div>
    </LmsFrame>
  );
}

export function GuidesListPage() {
  const { data, loading, error } = useAsyncPage(() => listGuides(), []);
  return (
    <LmsFrame title="Guides" loading={loading} error={error}>
      <div className="grid gap-4 lg:grid-cols-2">
        {(data || []).map((guide: LmsGuide) => (
          <Link key={guide.id} to={`/resources/guides/${guide.id}`} className="dashboard-card block p-5">
            <p className="text-sm text-[var(--text-secondary)]">{guide.subjectCode}</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--comp-text-primary)]">{guide.title}</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{guide.description}</p>
          </Link>
        ))}
      </div>
    </LmsFrame>
  );
}

export function GuideReaderPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { profile } = useSession();
  const { data, setData, loading, error } = useAsyncPage(() => getGuide(id), [id]);
  const registerNo = getProfileRegisterNo(profile);
  const canManageGuide = Boolean(
    data && (String(data.authorId || "").toUpperCase() === registerNo || registerNo === ADMIN_REGISTER_NO)
  );
  return (
    <LmsFrame title={data?.title || "Guide"} loading={loading} error={error}>
      <div className="flex flex-wrap gap-3">
        <Link to={`/resources/guides/new?clone=${id}`} className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_15%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-primary)]">
          Clone into editor
        </Link>
        {canManageGuide ? (
          <Link to={`/resources/guides/new?edit=${id}`} className="rounded-full border border-[var(--comp-border)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-primary)]">
            Edit
          </Link>
        ) : null}
        <button
          className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white"
          onClick={async () => {
            await toggleGuideUpvote(id);
            const next = await getGuide(id);
            setData(next);
          }}
        >
          Upvote
        </button>
        <a className="rounded-full border border-[color-mix(in_srgb,var(--info)_20%,transparent)] bg-[color-mix(in_srgb,var(--info)_10%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-primary)]" href={`/api/lms/guides/${id}/export`} target="_blank" rel="noreferrer">
          Export PDF
        </a>
        {canManageGuide ? (
          <button
            className="rounded-full border border-[color-mix(in_srgb,var(--error)_28%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--error)]"
            onClick={async () => {
              if (!window.confirm("Delete this guide?")) return;
              await deleteGuide(id);
              navigate("/resources/me/contributions");
            }}
          >
            Delete
          </button>
        ) : null}
      </div>
      {(data?.sections || []).map((section) => (
        <GuideSection
          key={section.id}
          section={section}
          onMarkRead={async (sectionId) => {
            const next = await markGuideSectionRead(id, sectionId);
            setData(next);
          }}
        />
      ))}
    </LmsFrame>
  );
}

export function GuideEditorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit") || "";
  const cloneId = searchParams.get("clone") || "";
  const sourceId = editId || cloneId;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [semester, setSemester] = useState("");
  const [unit, setUnit] = useState("");
  const [sections, setSections] = useState([{ title: "Introduction", content: "" }]);
  const sourceState = useAsyncPage<LmsGuide | null>(
    () => (sourceId ? getGuide(sourceId) : Promise.resolve(null)),
    [sourceId]
  );

  useEffect(() => {
    if (!sourceState.data) return;
    setTitle(editId ? sourceState.data.title : `${sourceState.data.title} Copy`);
    setDescription(sourceState.data.description || "");
    setSubjectCode(sourceState.data.subjectCode || "");
    setSubjectName(sourceState.data.subjectName || "");
    setSemester(sourceState.data.semester || "");
    setUnit(sourceState.data.unit || "");
    setSections(
      sourceState.data.sections?.length
        ? sourceState.data.sections.map((section) => ({ title: section.title, content: section.content }))
        : [{ title: "Introduction", content: "" }]
    );
  }, [sourceState.data?.id, editId]);

  return (
    <LmsFrame title={editId ? "Edit Guide" : "Guide Editor"} loading={Boolean(sourceId && sourceState.loading)} error={sourceState.error}>
      <div className="dashboard-card space-y-4 p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Guide title" value={title} onChange={(event) => setTitle(event.target.value)} />
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Subject code" value={subjectCode} onChange={(event) => setSubjectCode(event.target.value)} />
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Subject name" value={subjectName} onChange={(event) => setSubjectName(event.target.value)} />
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Semester" value={semester} onChange={(event) => setSemester(event.target.value)} />
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Unit" value={unit} onChange={(event) => setUnit(event.target.value)} />
        </div>
        <textarea className="min-h-24 rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
        {sections.map((section, index) => (
          <div key={index} className="space-y-2 rounded-2xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] p-4">
            <input className="w-full rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Section title" value={section.title} onChange={(event) => setSections(sections.map((entry, entryIndex) => entryIndex === index ? { ...entry, title: event.target.value } : entry))} />
            <textarea className="min-h-32 w-full rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Section content" value={section.content} onChange={(event) => setSections(sections.map((entry, entryIndex) => entryIndex === index ? { ...entry, content: event.target.value } : entry))} />
          </div>
        ))}
        <div className="flex gap-3">
          <button className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_15%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-primary)]" onClick={() => setSections([...sections, { title: `Section ${sections.length + 1}`, content: "" }])}>
            Add section
          </button>
          <button
            className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white"
            onClick={async () => {
              const payload = { title, description, subjectCode, subjectName, semester, unit, sections, published: true };
              const guide = editId ? await updateGuide(editId, payload) : await createGuide(payload);
              navigate(`/resources/guides/${guide.id}`);
            }}
          >
            {editId ? "Update guide" : "Publish guide"}
          </button>
        </div>
      </div>
    </LmsFrame>
  );
}

export function RoadmapsListPage() {
  const { data, loading, error } = useAsyncPage(() => listRoadmaps(), []);
  return (
    <LmsFrame title="Roadmaps" loading={loading} error={error}>
      <div className="grid gap-4 lg:grid-cols-2">
        {(data || []).map((roadmap: LmsRoadmap) => (
          <Link key={roadmap.id} to={`/resources/roadmaps/${roadmap.id}`} className="dashboard-card block p-5">
            <p className="text-sm text-[var(--text-secondary)]">{roadmap.skill}</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--comp-text-primary)]">{roadmap.title}</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{roadmap.description}</p>
          </Link>
        ))}
      </div>
    </LmsFrame>
  );
}

export function RoadmapViewerPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { profile } = useSession();
  const { data, setData, loading, error } = useAsyncPage(() => getRoadmap(id), [id]);
  const registerNo = getProfileRegisterNo(profile);
  const canManageRoadmap = Boolean(
    data && (String(data.authorId || "").toUpperCase() === registerNo || registerNo === ADMIN_REGISTER_NO)
  );
  return (
    <LmsFrame title={data?.title || "Roadmap"} loading={loading} error={error}>
      {data ? (
        <div className="space-y-4">
          {canManageRoadmap ? (
            <div className="flex justify-end">
              <button
                className="rounded-full border border-[color-mix(in_srgb,var(--error)_28%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--error)]"
                onClick={async () => {
                  if (!window.confirm("Delete this roadmap?")) return;
                  await deleteRoadmap(id);
                  navigate("/resources/me/contributions");
                }}
              >
                Delete roadmap
              </button>
            </div>
          ) : null}
          <RoadmapGraph
            roadmap={data}
            onComplete={async (nodeId) => {
              const next = await completeRoadmapNode(id, nodeId);
              setData(next);
            }}
          />
        </div>
      ) : null}
    </LmsFrame>
  );
}

export function RoadmapBuilderPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [skill, setSkill] = useState("");
  const [description, setDescription] = useState("");

  return (
    <LmsFrame title="Roadmap Builder">
      <div className="dashboard-card space-y-3 p-5">
        <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Roadmap title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Skill" value={skill} onChange={(event) => setSkill(event.target.value)} />
        <textarea className="min-h-24 rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
        <button
          className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white"
          onClick={async () => {
            const roadmap = await createRoadmap({ title, skill, description, published: true });
            await addRoadmapNode(roadmap.id, { title: "Start here", description: "Introduction", nodeType: "concept" });
            navigate(`/resources/roadmaps/${roadmap.id}`);
          }}
        >
          Create roadmap
        </button>
      </div>
    </LmsFrame>
  );
}

export function QuizModePage() {
  const { id = "" } = useParams();
  const { data, loading, error } = useAsyncPage(() => getLmsResource(id), [id]);
  const questions = useMemo(() => {
    const content = (data?.structuredContent as { questions?: Array<Record<string, unknown>> } | null) || null;
    return (content?.questions || []).map((question) => ({
      id: String(question.id || ""),
      question: String(question.question || ""),
      options: Array.isArray(question.options) ? question.options.map(String) : [],
      explanation: String(question.explanation || ""),
      correctIndex: Number(question.correctIndex || 0),
    }));
  }, [data]);

  return (
    <LmsFrame title={data?.title || "Quiz"} loading={loading} error={error}>
      <QuizRunner
        questions={questions}
        onSubmit={async (answers) => {
          await submitQuizAttempt(id, { answers, mode: "practice" });
          window.alert("Quiz submitted.");
        }}
      />
    </LmsFrame>
  );
}

export function FlashcardModePage() {
  const { id = "" } = useParams();
  const { data, loading, error } = useAsyncPage(() => getLmsResource(id), [id]);
  const cards = useMemo(() => {
    const content = (data?.structuredContent as { cards?: Array<Record<string, unknown>> } | null) || null;
    return content?.cards || [];
  }, [data]);
  return (
    <LmsFrame title={data?.title || "Flashcards"} loading={loading} error={error}>
      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map((card, index) => (
          <FlipCard key={index} front={String(card.front || "")} back={String(card.back || "")} />
        ))}
      </div>
    </LmsFrame>
  );
}

export function QuestionBankPage() {
  const [subjectCode, setSubjectCode] = useState("");
  const { data, setData, loading, error } = useAsyncPage(
    () => (subjectCode ? listQuestionBank({ subjectCode, limit: 50, page: 1 }) : Promise.resolve({ items: [], pagination: { page: 1, limit: 50 } })),
    [subjectCode]
  );
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState("Option A, Option B, Option C, Option D");
  const [correctIndex, setCorrectIndex] = useState(0);

  return (
    <LmsFrame title="Question Bank" loading={loading} error={error}>
      <SectionCard title="Contribute Question">
        <div className="grid gap-3">
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Subject code" value={subjectCode} onChange={(event) => setSubjectCode(event.target.value.toUpperCase())} />
          <textarea className="min-h-24 rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Question" value={question} onChange={(event) => setQuestion(event.target.value)} />
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Options comma separated" value={options} onChange={(event) => setOptions(event.target.value)} />
          <input className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" type="number" min={0} value={correctIndex} onChange={(event) => setCorrectIndex(Number(event.target.value))} />
          <div className="flex gap-3">
            <button
              className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white"
              onClick={async () => {
                await createQuestionBankItem({
                  subjectCode,
                  question,
                  options: options.split(",").map((item) => item.trim()).filter(Boolean),
                  correctIndex,
                });
                const next = await listQuestionBank({ subjectCode, limit: 50, page: 1 });
                setData(next);
              }}
            >
              Add question
            </button>
            <button
              className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_15%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-primary)]"
              onClick={async () => {
                const quiz = await buildQuizFromQuestionBank({ subjectCode, count: 5 });
                window.alert(`Generated ${quiz.count} questions`);
              }}
            >
              Build quiz
            </button>
          </div>
        </div>
      </SectionCard>
      <div className="space-y-3">
        {(data?.items || []).map((item) => (
          <div key={String(item.id)} className="dashboard-card space-y-2 p-4">
            <h3 className="text-base font-semibold text-[var(--comp-text-primary)]">{String(item.question || "")}</h3>
            <div className="space-y-1 text-sm text-[var(--text-secondary)]">
              {(Array.isArray(item.options) ? item.options : []).map((option, index) => (
                <div key={index}>{String(option)}</div>
              ))}
            </div>
            <button className="rounded-full bg-[var(--comp-accent)] px-3 py-1.5 text-xs font-semibold text-white" onClick={async () => {
              await upvoteQuestionBankItem(String(item.id));
              const next = await listQuestionBank({ subjectCode, limit: 50, page: 1 });
              setData(next);
            }}>
              Upvote
            </button>
          </div>
        ))}
      </div>
    </LmsFrame>
  );
}

export function MyContributionsPage() {
  const { data, loading, error } = useAsyncPage(() => getMyContributions(), []);
  const resources = ((data?.resources as LmsResource[]) || []);
  const guides = ((data?.guides as LmsGuide[]) || []);
  const roadmaps = ((data?.roadmaps as LmsRoadmap[]) || []);
  return (
    <LmsFrame title="My Contributions" loading={loading} error={error}>
      <RecommendationSection title="My Resources" items={resources} />
      <SectionCard title="My Guides">
        <div className="space-y-2">
          {guides.map((guide) => (
            <Link key={guide.id} to={`/resources/guides/${guide.id}`} className="dashboard-card block p-4">
              {guide.title}
            </Link>
          ))}
          {guides.length === 0 ? <p className="body-text">No guides published yet.</p> : null}
        </div>
      </SectionCard>
      <SectionCard title="My Roadmaps">
        <div className="space-y-2">
          {roadmaps.map((roadmap) => (
            <Link key={roadmap.id} to={`/resources/roadmaps/${roadmap.id}`} className="dashboard-card block p-4">
              {roadmap.title}
            </Link>
          ))}
          {roadmaps.length === 0 ? <p className="body-text">No roadmaps published yet.</p> : null}
        </div>
      </SectionCard>
    </LmsFrame>
  );
}

export function SavedResourcesPage() {
  const { data, loading, error } = useAsyncPage(() => getMyBookmarks(), []);
  return (
    <LmsFrame title="Saved Resources" loading={loading} error={error}>
      <ResourceGrid items={data || []} />
    </LmsFrame>
  );
}

export function CollectionsPage() {
  const { data, setData, loading, error } = useAsyncPage(() => listLmsCollections(), []);
  const [name, setName] = useState("");
  return (
    <LmsFrame title="Collections" loading={loading} error={error}>
      <SectionCard title="Create collection">
        <div className="flex gap-3">
          <input className="flex-1 rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-2" placeholder="Collection name" value={name} onChange={(event) => setName(event.target.value)} />
          <button className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white" onClick={async () => {
            await createLmsCollection({ name });
            const next = await listLmsCollections();
            setData(next);
            setName("");
          }}>
            Create
          </button>
        </div>
      </SectionCard>
      <div className="grid gap-4 lg:grid-cols-2">
        {(data || []).map((collection) => (
          <Link key={collection.id} to={`/resources/me/collections?collectionId=${collection.id}`} className="dashboard-card block p-4">
            <h3 className="text-base font-semibold text-[var(--comp-text-primary)]">{collection.name}</h3>
            <p className="text-sm text-[var(--text-secondary)]">{collection.description || "No description"}</p>
          </Link>
        ))}
      </div>
    </LmsFrame>
  );
}

export function ProgressPage() {
  const progress = useAsyncPage(() => getLmsProgress(), []);
  const mastery = useAsyncPage(() => getLmsMastery(), []);
  return (
    <LmsFrame title="Progress" loading={progress.loading || mastery.loading} error={progress.error || mastery.error}>
      <SectionCard title="Summary">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="dashboard-card p-4">
            <p className="text-sm text-[var(--text-secondary)]">Started</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">{String(progress.data?.started || 0)}</p>
          </div>
          <div className="dashboard-card p-4">
            <p className="text-sm text-[var(--text-secondary)]">Completed</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">{String(progress.data?.completed || 0)}</p>
          </div>
          <div className="dashboard-card p-4">
            <p className="text-sm text-[var(--text-secondary)]">Completion rate</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">{String(progress.data?.completionRate || 0)}%</p>
          </div>
        </div>
      </SectionCard>
      <TopicMasteryHeatmap
        items={(mastery.data || []).map((entry) => ({
          label: String(entry.label || "Topic"),
          mastery: Number(entry.mastery || 0),
        }))}
      />
    </LmsFrame>
  );
}

export function RevisionQueuePage() {
  const { data, setData, loading, error } = useAsyncPage(() => getRevisionQueue(), []);
  return (
    <LmsFrame title="Revision Queue" loading={loading} error={error}>
      <div className="space-y-3">
        {(data || []).map((entry) => (
          <div key={String(entry.resourceId)} className="dashboard-card flex items-center justify-between gap-4 p-4">
            <div>
              <h3 className="text-base font-semibold text-[var(--comp-text-primary)]">{String(entry.title || "")}</h3>
              <p className="text-sm text-[var(--text-secondary)]">Due {String(entry.dueDate || "")}</p>
            </div>
            <div className="flex gap-2">
              <button className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700" onClick={async () => setData(await submitRevisionReview(String(entry.resourceId), 40))}>Again</button>
              <button className="rounded-full bg-[var(--comp-accent)] px-3 py-1.5 text-xs font-semibold text-white" onClick={async () => setData(await submitRevisionReview(String(entry.resourceId), 85))}>Reviewed</button>
            </div>
          </div>
        ))}
      </div>
    </LmsFrame>
  );
}

export function ExamFeedbackPage() {
  const { data, loading, error } = useAsyncPage(() => getPendingExamFeedback(), []);
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  return (
    <LmsFrame title="Exam Feedback" loading={loading} error={error}>
      <div className="space-y-3">
        {(data || []).map((resource) => (
          <ExamFeedbackCard key={resource.id} resource={resource} value={votes[resource.id]} onChange={(next) => setVotes({ ...votes, [resource.id]: next })} />
        ))}
      </div>
      <button
        className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white"
        onClick={async () => {
          const feedbackItems = Object.entries(votes).map(([resourceId, helpful]) => ({ resourceId, helpful }));
          await submitExamFeedback(feedbackItems);
          window.alert("Feedback submitted.");
        }}
      >
        Submit feedback
      </button>
    </LmsFrame>
  );
}
