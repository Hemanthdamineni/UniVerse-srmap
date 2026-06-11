import { SectionCard } from "../../../components/erp/ErpPrimitives";
import type {
  ContentWorkflowSpec,
  ResourceCatalogCourse,
  ResourceCatalogResponse,
  ResourceLibraryResponse,
  ResourceSubjectResponse,
} from "../../../lib/lmsApi";
import { canPreviewResource } from "./constants";

type WorkflowMapProps = {
  workflow: ContentWorkflowSpec;
};

type ResourceFiltersProps = {
  advanced: boolean;
  catalog: ResourceCatalogResponse | null;
  coursesForYear: ResourceCatalogCourse[];
  subjects: ResourceSubjectResponse | null;
  selectedYear: number | null;
  selectedCourseCode: string;
  selectedSubjectCode: string;
  search: string;
  onYearChange: (year: number | null) => void;
  onCourseChange: (courseCode: string) => void;
  onSubjectChange: (subjectCode: string) => void;
  onSearchChange: (search: string) => void;
};

type ResourceLibraryProps = {
  advanced: boolean;
  libraryLoading: boolean;
  library: ResourceLibraryResponse | null;
  onPreviewResource: (url: string) => void;
};

export function WorkflowMap({ workflow }: WorkflowMapProps) {
  return (
    <SectionCard title="Admin Workflow Map">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
          <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">Lifecycle states</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {workflow.states.map((state) => (
              <span
                key={state}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]"
              >
                {state}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
          <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">Bulk safety</h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{workflow.bulkSafety.rollback}</p>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            Limit: {workflow.bulkSafety.maxItems} items per operation.
          </p>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {workflow.transitions.map((transition) => (
          <div key={transition.action} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
            <span className="font-semibold text-[var(--comp-text-primary)]">{transition.label}</span>
            <span className="text-[var(--text-secondary)]">: {transition.from.join(", ")} to {transition.to}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export function ResourceFilters({
  advanced,
  catalog,
  coursesForYear,
  subjects,
  selectedYear,
  selectedCourseCode,
  selectedSubjectCode,
  search,
  onYearChange,
  onCourseChange,
  onSubjectChange,
  onSearchChange,
}: ResourceFiltersProps) {
  return (
    <SectionCard title={advanced ? "Advanced Access Filters" : "Resource Browser"}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="resource-year" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
            Year
          </label>
          <select
            id="resource-year"
            value={selectedYear ?? ""}
            onChange={(event) => onYearChange(Number(event.target.value || 0) || null)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
          >
            {(catalog?.years || []).map((year) => (
              <option key={year} value={year}>
                Year {year}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="resource-course" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
            Course
          </label>
          <select
            id="resource-course"
            value={selectedCourseCode}
            onChange={(event) => onCourseChange(event.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
          >
            {coursesForYear.map((course) => (
              <option key={course.courseCode} value={course.courseCode}>
                {course.courseName} ({course.subjectCount} subjects)
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="resource-subject" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
            Subject
          </label>
          <select
            id="resource-subject"
            value={selectedSubjectCode}
            onChange={(event) => onSubjectChange(event.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
          >
            {(subjects?.subjects || []).map((subject) => (
              <option key={subject.subjectCode} value={subject.subjectCode}>
                {subject.subjectName} ({subject.resourceCount} resources)
              </option>
            ))}
          </select>
        </div>

        {advanced ? (
          <div className="md:col-span-2">
            <label htmlFor="resource-search" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
              Search Resources
            </label>
            <input
              id="resource-search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by title, description, or tag"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
            />
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

export function ResourcePreview({ previewUrl }: { previewUrl: string }) {
  return (
    <SectionCard title="Live Preview">
      {previewUrl ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
          <iframe title="Resource Preview" src={previewUrl} className="h-[420px] w-full" />
        </div>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">
          Select a subject with previewable PDFs to see an inline preview here.
        </p>
      )}
    </SectionCard>
  );
}

export function ResourceLibrary({ advanced, libraryLoading, library, onPreviewResource }: ResourceLibraryProps) {
  return (
    <SectionCard title={advanced ? "Advanced Resource Library" : "Resource Library"}>
      {libraryLoading ? (
        <p className="text-sm text-[var(--text-secondary)]">Loading resources for the selected subject...</p>
      ) : !library?.groups.length ? (
        <p className="text-sm text-[var(--text-secondary)]">No resources are available for the selected subject yet.</p>
      ) : (
        <div className="space-y-4">
          {library.groups.map((group) => (
            <div key={group.group} className="rounded-2xl border border-[var(--border)] bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">{group.label}</h3>
                  <p className="text-xs text-[var(--text-secondary)]">{group.items.length} item(s)</p>
                </div>
              </div>
              <div className="space-y-3">
                {group.items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--comp-surface-hover)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--comp-text-primary)]">{item.title}</h4>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                          {item.description || "No description provided."}
                        </p>
                        {Array.isArray(item.metadata?.tags) && item.metadata.tags.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {item.metadata.tags.map((tag) => (
                              <span
                                key={String(tag)}
                                className="rounded-full bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--comp-text-primary)]"
                              >
                                {String(tag)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {item.metadata?.featured ? (
                        <span className="rounded-full border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-2.5 py-0.5 text-xs font-bold text-[var(--warning)]">
                          Featured
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.resources.map((resource) => (
                        <div key={resource.id} className="flex flex-wrap gap-2">
                          <a
                            href={resource.urlOrPath}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--comp-text-primary)] transition hover:border-[var(--comp-accent)]"
                          >
                            Open {resource.kind.toUpperCase()}
                          </a>
                          {canPreviewResource(resource.urlOrPath, resource.kind) ? (
                            <button
                              type="button"
                              onClick={() => onPreviewResource(resource.urlOrPath)}
                              className="rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--comp-accent)] hover:text-[var(--comp-text-primary)]"
                            >
                              Preview
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
