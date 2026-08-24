import { useParams, useSearchParams } from "react-router-dom";
import {
  listLmsResources,
  useAsyncPage,
  LmsFrame,
  SectionCard,
  ResourceGrid,
} from "../_shared/LmsPageShared";
import { SegmentedControl, SkeletonCard } from "../../../components/ui";
import { PYQBankSection } from "../PYQBankPage";
import { SubjectOverviewSection } from "../SubjectOverviewPage";

type SubjectTab = "overview" | "resources" | "pyq";

const TAB_OPTIONS = [
  { label: "Overview", value: "overview" as const },
  { label: "Resources", value: "resources" as const },
  { label: "PYQ papers", value: "pyq" as const },
] as const;

function SubjectResourcesSection({ code }: { code: string }) {
  const { data, loading, error } = useAsyncPage(
    () => listLmsResources({ subjectCode: code, limit: 24, sort: "quality" }),
    [code]
  );

  if (loading && !data) return <SkeletonCard />;
  if (error) return <p className="body-text text-sm text-[var(--error)]">{error}</p>;

  return (
    <SectionCard title={`Community resources · ${code}`}>
      <ResourceGrid
        items={data?.items || []}
        emptyTitle={`No community resources for ${code} yet`}
        emptyDescription="Be the first to share a note, link, or past paper for this subject."
        emptyActionLabel="Contribute a resource"
        emptyActionTo="/learn/contribute/new"
      />
    </SectionCard>
  );
}

export default function SubjectHubPage() {
  const { code = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const tab: SubjectTab = TAB_OPTIONS.some((option) => option.value === requested)
    ? (requested as SubjectTab)
    : "overview";

  return (
    <LmsFrame title={`Subject ${code}`}>
      <div className="space-y-4">
        <SegmentedControl
          options={TAB_OPTIONS}
          value={tab}
          onChange={(value) =>
            setSearchParams((prev) => ({ ...Object.fromEntries(prev), tab: value }), { replace: true })
          }
        />
        {tab === "overview" ? <SubjectOverviewSection code={code} /> : null}
        {tab === "resources" ? <SubjectResourcesSection code={code} /> : null}
        {tab === "pyq" ? <PYQBankSection code={code} /> : null}
      </div>
    </LmsFrame>
  );
}
