import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SegmentedControl } from "../../../components/ui";
import QuestionBankPage from "../QuestionBankPage";
import RevisionQueuePage from "../me/RevisionQueuePage";
import { getExamPrepRecommendations, useAsyncPage } from "../_shared/LmsPageShared";
import RecommendationSection from "../../../components/lms/RecommendationSection";

type PracticeTab = "revision" | "questions" | "exam-prep";

const TAB_OPTIONS = [
  { label: "Revision", value: "revision" as const },
  { label: "Question Bank", value: "questions" as const },
  { label: "Exam Prep", value: "exam-prep" as const },
] as const;

const TAB_VALUES = new Set<string>(TAB_OPTIONS.map((option) => option.value));

export default function PracticePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tabState, setTabState] = useState<PracticeTab | null>(null);
  const requested = searchParams.get("tab");
  const tab: PracticeTab =
    tabState ?? (TAB_VALUES.has(String(requested)) ? (requested as PracticeTab) : "revision");
  const examPrep = useAsyncPage(
    () => (tab === "exam-prep" ? getExamPrepRecommendations({ limit: 6 }) : Promise.resolve([])),
    [tab]
  );

  const selectTab = (value: string) => {
    setTabState(value as PracticeTab);
    setSearchParams((prev) => ({ ...Object.fromEntries(prev), tab: value }), { replace: true });
  };

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={selectTab} />
      {tab === "revision" ? <RevisionQueuePage /> : null}
      {tab === "questions" ? <QuestionBankPage /> : null}
      {tab === "exam-prep" ? (
        <div className="space-y-4">
          <RecommendationSection title="Exam prep picks" items={examPrep.data || []} />
          <p className="body-text text-sm">
            Past papers live on each subject hub — open one from{" "}
            <Link to="/learn/discover" className="font-medium text-[var(--info)] underline underline-offset-2">
              Learn
            </Link>{" "}
            and switch to its PYQ tab.
          </p>
        </div>
      ) : null}
    </div>
  );
}
