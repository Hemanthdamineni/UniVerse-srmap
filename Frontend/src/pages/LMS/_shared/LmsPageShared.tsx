import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
// LMS shell: InlineError in frame; StatCard momentum row; resource preview uses comp-surface tokens.
import { ErpPageShell, SectionCard } from "../../../components/erp/ErpPrimitives";
import { InlineError, EmptyView } from "../../../components/ui/Feedback";
import { StatCard } from "../../../components/ui/Progress";
import AnnotationPanel from "../../../components/lms/AnnotationPanel";
import { DuplicateWarning, OutdatedWarning } from "../../../components/lms/LmsChips";
import ExamFeedbackCard from "../../../components/lms/ExamFeedbackCard";
import InteractiveFlashcardDeck from "../../../components/lms/InteractiveFlashcardDeck";
import GuideSection from "../../../components/lms/GuideSection";
import QuizRunner from "../../../components/lms/QuizRunner";
import RecommendationSection from "../../../components/lms/RecommendationSection";
import RequestCard from "../../../components/lms/RequestCard";
import ResourceFilterPanel, { type ResourceFilterState } from "../../../components/lms/ResourceFilterPanel";
import ResourceGrid from "../../../components/lms/ResourceGrid";
import RoadmapGraph from "../../../components/lms/RoadmapGraph";
import TopicMasteryHeatmap from "../../../components/lms/TopicMasteryHeatmap";
import WeeklyLeaderboard from "../../../components/lms/WeeklyLeaderboard";
import { Markdown } from "../../../components/markdown";
import {
  addRoadmapNode,
  buildQuizFromQuestionBank,
  checkLmsDuplicate,
  completeRoadmapNode,
  createGuide,
  closeLmsRequest,
  createLmsCollection,
  deleteLmsCollection,
  getLmsCollection,
  removeFromLmsCollection,
  updateLmsCollection,
  createLmsRequest,
  createLmsResource,
  deleteGuide,
  deleteLmsResource,
  restoreLmsResource,
  createQuestionBankItem,
  createRoadmap,
  deleteLmsAnnotation,
  deleteRoadmap,
  flagLmsResource,
  generateLearningSession,
  getContinueLearning,
  getContributorProfile,
  getExamPrepRecommendations,
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
  getRoadmapRecommendations,
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
} from "../../../lib/lms/index";
import { useSession } from "../../../hooks/useSession";

/** Returns true if the profile has an admin/faculty-admin role (backend-driven — no hardcoded IDs). */
export function isProfileAdmin(profile: Record<string, unknown> | null | undefined): boolean {
  if (!profile) return false;
  const role = String(profile.role ?? profile.userRole ?? profile.platformRole ?? '').toLowerCase();
  return role === 'admin' || role === 'faculty_admin' || role === 'lms_admin' || role === 'platform_admin';
}

export type ResourceFormState = {
  type: string;
  title: string;
  description: string;
  semester: string;
  subjectCode: string;
  subjectName: string;
  unit: string;
  url?: string;
  noteContent?: string;
  difficulty: string;
  tags: string;
  examYear?: string;
  examType?: string;
  examMonth?: string;
  file?: File | null;
};

export function getProfileRegisterNo(profile: Record<string, unknown> | null | undefined) {
  const table =
    profile && typeof profile.TableContent === "object" && profile.TableContent
      ? (profile.TableContent as Record<string, unknown>)
      : null;

  return String(table?.["Register No."] || profile?.regNo || profile?.registerNo || "").trim().toUpperCase();
}

export function createEmptyResourceForm(): ResourceFormState {
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

export function resourceToForm(resource: LmsResource): ResourceFormState {
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

export function buildResourcePayload(form: ResourceFormState) {
  return {
    ...form,
    subjectCode: form.subjectCode.trim().toUpperCase(),
    tags: form.tags.split(",").map((item) => item.trim()).filter(Boolean),
    file: form.file || undefined,
  };
}

export function useAsyncPage<T>(loader: () => Promise<T>, deps: unknown[]) {
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

export function LmsFrame({
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
      {error ? (
        <InlineError
          title={`Could not load ${title}`}
          message={error}
          description="Your ERP session may have expired, or the LMS service may be temporarily unavailable."
          action={
            <Link to="/resources" className="rounded-md border border-[var(--comp-border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] no-underline">
              Back to LMS home
            </Link>
          }
          className="mb-4"
        />
      ) : null}
      <div className="space-y-5">{children}</div>
    </ErpPageShell>
  );
}

export function renderResourceBody(resource: LmsResource) {
  const structured = (resource.structuredContent as
    | { questions?: Array<Record<string, unknown>>; cards?: Array<Record<string, unknown>> }
    | null
    | undefined) || null;
  if (resource.type === "quiz" && structured?.questions?.length) {
    return (
      <QuizRunner
        questions={structured.questions.map((question) => ({
          id: String(question.id || ""),
          question: String(question.question || ""),
          options: Array.isArray(question.options) ? question.options.map(String) : [],
          explanation: String(question.explanation || ""),
          correctIndex: Number(question.correctIndex || 0),
        }))}
        onSubmit={async (answers) => {
          await submitQuizAttempt(resource.id, { answers, mode: "practice" });
        }}
      />
    );
  }
  if (resource.type === "flashcard" && structured?.cards?.length) {
    return (
      <InteractiveFlashcardDeck
        cards={structured.cards.map((card) => ({
          front: String(card.front || ""),
          back: String(card.back || ""),
        }))}
      />
    );
  }
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
  if (resource.renderType === "markdown" || resource.renderType === "note" || resource.type === "note") {
    return (
      <div className="rounded-2xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-5">
        {resource.noteContent ? (
          <Markdown>{resource.noteContent}</Markdown>
        ) : (
          <p className="body-text text-sm">No note content yet.</p>
        )}
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


export { useEffect, useMemo, useState };
export { Link, useNavigate, useParams, useSearchParams };
export { ErpPageShell, SectionCard };
export { InlineError };
export { EmptyView };
export { StatCard };
export { default as AnnotationPanel } from "../../../components/lms/AnnotationPanel";
export { DuplicateWarning } from "../../../components/lms/LmsChips";
export { default as ExamFeedbackCard } from "../../../components/lms/ExamFeedbackCard";
export { default as InteractiveFlashcardDeck } from "../../../components/lms/InteractiveFlashcardDeck";
export { default as GuideSection } from "../../../components/lms/GuideSection";
export { OutdatedWarning } from "../../../components/lms/LmsChips";
export { default as QuizRunner } from "../../../components/lms/QuizRunner";
export { default as RecommendationSection } from "../../../components/lms/RecommendationSection";
export { default as RequestCard } from "../../../components/lms/RequestCard";
export { default as ResourceFilterPanel } from "../../../components/lms/ResourceFilterPanel";
export { default as ResourceGrid } from "../../../components/lms/ResourceGrid";
export { default as RoadmapGraph } from "../../../components/lms/RoadmapGraph";
export { default as TopicMasteryHeatmap } from "../../../components/lms/TopicMasteryHeatmap";
export { default as WeeklyLeaderboard } from "../../../components/lms/WeeklyLeaderboard";
export type { ResourceFilterState } from "../../../components/lms/ResourceFilterPanel";
export {
  addRoadmapNode,
  buildQuizFromQuestionBank,
  checkLmsDuplicate,
  completeRoadmapNode,
  createGuide,
  createLmsCollection,
  deleteLmsCollection,
  getLmsCollection,
  removeFromLmsCollection,
  updateLmsCollection,
  createLmsRequest,
  createLmsResource,
  deleteGuide,
  deleteLmsResource,
  restoreLmsResource,
  createQuestionBankItem,
  createRoadmap,
  deleteLmsAnnotation,
  deleteRoadmap,
  flagLmsResource,
  generateLearningSession,
  getContinueLearning,
  getContributorProfile,
  getExamPrepRecommendations,
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
  getRoadmapRecommendations,
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
  closeLmsRequest,
  upvoteQuestionBankItem,
} from "../../../lib/lms/index";
export type { LmsCollection, LmsGuide, LmsRequest, LmsResource, LmsRoadmap } from "../../../lib/lms/index";
export { useSession } from "../../../hooks/useSession";
