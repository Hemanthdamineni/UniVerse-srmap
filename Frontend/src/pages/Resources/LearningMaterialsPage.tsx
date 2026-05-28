import { useCallback, useEffect, useMemo, useState } from "react";
import { ErpPageShell, SectionCard, StatusBanner } from "../../components/erp/ErpPrimitives";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import {
  createResourceRecommendation,
  createLearningMaterialItem,
  deleteLearningMaterialItem,
  executeLearningMaterialBulkAction,
  getContentWorkflow,
  getLearningMaterialCatalog,
  getLearningMaterialHistory,
  getLearningMaterialLibrary,
  getLearningMaterialSubjects,
  listResourceRecommendations,
  listAdminLearningMaterialItems,
  uploadResourceFile,
  type LearningResourceItem,
  type ResourceRecommendation,
  type ResourceCatalogResponse,
  type ResourceLibraryResponse,
  type ResourceSubjectResponse,
  reviewResourceRecommendation,
  previewLearningMaterialBulkAction,
  transitionLearningMaterialLifecycle,
  updateLearningMaterialItem,
  type ContentBulkPreview,
  type ContentHistoryEntry,
  type ContentWorkflowSpec,
} from "../../lib/lmsApi";

type Props = {
  blueprint: PageBlueprint;
  advanced?: boolean;
  adminMode?: boolean;
};

const RESOURCE_GROUPS = [
  { value: "pyq-mid", label: "PYQ Mid" },
  { value: "pyq-sem", label: "PYQ Semester" },
  { value: "slides", label: "Slides" },
  { value: "notes", label: "Notes" },
  { value: "links", label: "Links" },
  { value: "videos", label: "Videos" },
  { value: "roadmaps", label: "Roadmaps" },
];

function canPreviewResource(url: string, kind: string) {
  const normalizedUrl = String(url || "").toLowerCase();
  const normalizedKind = String(kind || "").toLowerCase();
  return normalizedKind === "pdf" || normalizedUrl.includes("drive.google.com") || normalizedUrl.endsWith(".pdf");
}

export default function LearningMaterialsPage({ blueprint, advanced = false, adminMode = false }: Props) {
  const admin = useAdminAccess();
  const [catalog, setCatalog] = useState<ResourceCatalogResponse | null>(null);
  const [subjects, setSubjects] = useState<ResourceSubjectResponse | null>(null);
  const [library, setLibrary] = useState<ResourceLibraryResponse | null>(null);
  const [adminItems, setAdminItems] = useState<Array<LearningResourceItem & { createdAt?: string }>>([]);
  const [workflow, setWorkflow] = useState<ContentWorkflowSpec | null>(null);
  const [selectedAdminIds, setSelectedAdminIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("unpublish");
  const [bulkPreview, setBulkPreview] = useState<ContentBulkPreview | null>(null);
  const [historyOpenId, setHistoryOpenId] = useState("");
  const [historyItems, setHistoryItems] = useState<ContentHistoryEntry[]>([]);
  const [recommendations, setRecommendations] = useState<ResourceRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedCourseCode, setSelectedCourseCode] = useState("");
  const [selectedSubjectCode, setSelectedSubjectCode] = useState("");
  const [search, setSearch] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [editingId, setEditingId] = useState("");
  const [banner, setBanner] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [uploadingResource, setUploadingResource] = useState(false);
  const [uploadingRecommendation, setUploadingRecommendation] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    url: "",
    kind: "pdf",
    resourceGroup: "notes",
    visibility: "visible",
    featured: false,
    tags: "",
  });
  const [recommendationForm, setRecommendationForm] = useState({
    title: "",
    description: "",
    url: "",
    kind: "link",
    resourceGroup: "links",
  });

  const loadCatalog = useCallback(async (year?: number | null) => {
    const nextCatalog = await getLearningMaterialCatalog(year);
    setCatalog(nextCatalog);
    const nextYear = year ?? nextCatalog.selectedYear ?? nextCatalog.years[0] ?? null;
    setSelectedYear(nextYear);
    const firstCourse =
      nextCatalog.courses.find((course) => (nextYear === null ? true : course.year === nextYear)) ||
      nextCatalog.courses[0] ||
      null;
    setSelectedCourseCode(firstCourse?.courseCode || "");
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loadCatalog()
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load learning materials.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadCatalog]);

  useEffect(() => {
    if (!adminMode || !admin.unlocked) {
      setWorkflow(null);
      setSelectedAdminIds([]);
      setBulkPreview(null);
      return;
    }
    let active = true;
    getContentWorkflow(admin.adminHeaders)
      .then((spec) => {
        if (!active) return;
        setWorkflow(spec);
      })
      .catch(() => {
        if (!active) return;
        setWorkflow(null);
      });
    return () => {
      active = false;
    };
  }, [admin.adminHeaders, admin.unlocked, adminMode]);

  useEffect(() => {
    if (!selectedYear || !selectedCourseCode) {
      setSubjects(null);
      setSelectedSubjectCode("");
      return;
    }

    let active = true;
    getLearningMaterialSubjects(selectedYear, selectedCourseCode)
      .then((response) => {
        if (!active) return;
        setSubjects(response);
        setSelectedSubjectCode((current) =>
          current && response.subjects.some((subject) => subject.subjectCode === current)
            ? current
            : (response.subjects[0]?.subjectCode || "")
        );
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load subject list.");
      });

    return () => {
      active = false;
    };
  }, [selectedCourseCode, selectedYear]);

  useEffect(() => {
    if (!selectedYear || !selectedCourseCode || !selectedSubjectCode) {
      setLibrary(null);
      setAdminItems([]);
      setPreviewUrl("");
      return;
    }

    let active = true;
    setLibraryLoading(true);
    setError(null);

    Promise.all([
      getLearningMaterialLibrary({
        year: selectedYear,
        courseCode: selectedCourseCode,
        subjectCode: selectedSubjectCode,
        query: advanced ? search : "",
      }),
      adminMode && admin.unlocked
        ? listAdminLearningMaterialItems(
            {
              year: String(selectedYear),
              courseCode: selectedCourseCode,
              subjectCode: selectedSubjectCode,
              includeDeleted: "true",
            },
            admin.adminHeaders
          )
        : Promise.resolve({ items: [] }),
      adminMode && admin.unlocked ? listResourceRecommendations(admin.adminHeaders) : Promise.resolve({ items: [] }),
    ])
      .then(([libraryResponse, adminResponse, recommendationResponse]) => {
        if (!active) return;
        setLibrary(libraryResponse);
        setAdminItems(adminResponse.items);
        setRecommendations(recommendationResponse.items || []);

        const previewCandidate = libraryResponse.groups
          .flatMap((group) => group.items)
          .flatMap((item) => item.resources)
          .find((resource) => canPreviewResource(resource.urlOrPath, resource.kind));
        setPreviewUrl(previewCandidate?.urlOrPath || "");
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load selected resources.");
      })
      .finally(() => {
        if (!active) return;
        setLibraryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [admin.adminHeaders, admin.unlocked, adminMode, advanced, search, selectedCourseCode, selectedSubjectCode, selectedYear]);

  const coursesForYear = useMemo(
    () => (catalog?.courses || []).filter((course) => (selectedYear === null ? true : course.year === selectedYear)),
    [catalog?.courses, selectedYear]
  );

  const selectedCourse = coursesForYear.find((course) => course.courseCode === selectedCourseCode) || null;
  const selectedSubject =
    subjects?.subjects.find((subject) => subject.subjectCode === selectedSubjectCode) || null;

  async function refreshCurrentSelection() {
    if (!selectedYear || !selectedCourseCode || !selectedSubjectCode) return;
    const [libraryResponse, adminResponse, recommendationResponse] = await Promise.all([
      getLearningMaterialLibrary({
        year: selectedYear,
        courseCode: selectedCourseCode,
        subjectCode: selectedSubjectCode,
        query: advanced ? search : "",
      }),
      adminMode && admin.unlocked
        ? listAdminLearningMaterialItems(
            {
              year: String(selectedYear),
              courseCode: selectedCourseCode,
              subjectCode: selectedSubjectCode,
              includeDeleted: "true",
            },
            admin.adminHeaders
          )
        : Promise.resolve({ items: [] }),
      adminMode && admin.unlocked ? listResourceRecommendations(admin.adminHeaders) : Promise.resolve({ items: [] }),
    ]);
    setLibrary(libraryResponse);
    setAdminItems(adminResponse.items);
    setRecommendations(recommendationResponse.items || []);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedYear || !selectedCourse || !selectedSubject) return;
    setBanner(null);

    if (!form.url.trim()) {
      setBanner({ tone: "warning", text: "Provide a URL or upload a file first." });
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: selectedCourse.courseCode,
      metadata: {
        year: selectedYear,
        courseCode: selectedCourse.courseCode,
        courseName: selectedCourse.courseName,
        subjectCode: selectedSubject.subjectCode,
        subjectName: selectedSubject.subjectName,
        semester: selectedSubject.semester,
        resourceGroup: form.resourceGroup,
        visibility: form.visibility,
        featured: form.featured,
        tags: form.tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      },
      resources: [
        {
          kind: form.kind,
          title: form.title.trim(),
          url_or_path: form.url.trim(),
        },
      ],
    };

    try {
      if (editingId) {
        await updateLearningMaterialItem(editingId, payload, admin.adminHeaders);
        setBanner({ tone: "success", text: "Resource updated successfully." });
      } else {
        await createLearningMaterialItem(payload, admin.adminHeaders);
        setBanner({ tone: "success", text: "Resource published successfully." });
      }
      setEditingId("");
      setForm({
        title: "",
        description: "",
        url: "",
        kind: "pdf",
        resourceGroup: "notes",
        visibility: "visible",
        featured: false,
        tags: "",
      });
      await refreshCurrentSelection();
    } catch (submitError) {
      setBanner({
        tone: "warning",
        text: submitError instanceof Error ? submitError.message : "Failed to save resource.",
      });
    }
  }

  async function handleRecommendationSubmit(event: React.FormEvent) {
    if (!recommendationForm.url.trim()) {
      setBanner({ tone: "warning", text: "Provide a URL or upload a file first." });
      return;
    }

    event.preventDefault();
    if (!selectedYear || !selectedCourse || !selectedSubject) return;
    setBanner(null);

    try {
      await createResourceRecommendation({
        title: recommendationForm.title.trim(),
        description: recommendationForm.description.trim(),
        url: recommendationForm.url.trim(),
        kind: recommendationForm.kind,
        year: selectedYear,
        courseCode: selectedCourse.courseCode,
        courseName: selectedCourse.courseName,
        subjectCode: selectedSubject.subjectCode,
        subjectName: selectedSubject.subjectName,
        resourceGroup: recommendationForm.resourceGroup,
      });
      setRecommendationForm({
        title: "",
        description: "",
        url: "",
        kind: "link",
        resourceGroup: "links",
      });
      setBanner({ tone: "success", text: "Recommendation submitted. Admin will review and decide." });
    } catch (submitError) {
      setBanner({
        tone: "warning",
        text: submitError instanceof Error ? submitError.message : "Failed to submit recommendation.",
      });
    }
  }

  async function handleMaterialFileUpload(file: File | null) {
    if (!file) return;
    setUploadingResource(true);
    setBanner(null);
    try {
      const uploaded = await uploadResourceFile(file);
      const normalizedKind = uploaded.mimeType.includes("pdf")
        ? "pdf"
        : uploaded.mimeType.includes("presentation") || uploaded.fileName.match(/\.(ppt|pptx)$/i)
          ? "ppt"
          : uploaded.mimeType.includes("video")
            ? "video"
            : "link";
      setForm((prev) => ({
        ...prev,
        url: uploaded.url,
        kind: normalizedKind,
      }));
      setBanner({ tone: "success", text: `Uploaded ${uploaded.fileName}.` });
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Failed to upload file.",
      });
    } finally {
      setUploadingResource(false);
    }
  }

  async function handleRecommendationFileUpload(file: File | null) {
    if (!file) return;
    setUploadingRecommendation(true);
    setBanner(null);
    try {
      const uploaded = await uploadResourceFile(file);
      const normalizedKind = uploaded.mimeType.includes("pdf")
        ? "pdf"
        : uploaded.mimeType.includes("presentation") || uploaded.fileName.match(/\.(ppt|pptx)$/i)
          ? "ppt"
          : uploaded.mimeType.includes("video")
            ? "video"
            : "link";
      setRecommendationForm((prev) => ({
        ...prev,
        url: uploaded.url,
        kind: normalizedKind,
      }));
      setBanner({ tone: "success", text: `Uploaded ${uploaded.fileName}.` });
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Failed to upload file.",
      });
    } finally {
      setUploadingRecommendation(false);
    }
  }

  function toggleAdminSelection(contentId: string) {
    setSelectedAdminIds((prev) =>
      prev.includes(contentId) ? prev.filter((id) => id !== contentId) : [...prev, contentId]
    );
    setBulkPreview(null);
  }

  async function handleLifecycleAction(contentId: string, action: string) {
    try {
      await transitionLearningMaterialLifecycle(
        contentId,
        { action, reason: `Admin ${action} action from content management` },
        admin.adminHeaders
      );
      setBanner({ tone: "success", text: `Lifecycle action ${action} completed.` });
      await refreshCurrentSelection();
    } catch (lifecycleError) {
      setBanner({
        tone: "warning",
        text: lifecycleError instanceof Error ? lifecycleError.message : "Lifecycle action failed.",
      });
    }
  }

  async function handleHistory(contentId: string) {
    try {
      const response = await getLearningMaterialHistory(contentId, admin.adminHeaders);
      setHistoryOpenId(contentId);
      setHistoryItems(response.items || []);
    } catch (historyError) {
      setBanner({
        tone: "warning",
        text: historyError instanceof Error ? historyError.message : "Failed to load change history.",
      });
    }
  }

  async function handleBulkPreview() {
    if (!selectedAdminIds.length) {
      setBanner({ tone: "warning", text: "Select at least one resource for bulk action preview." });
      return;
    }
    try {
      const preview = await previewLearningMaterialBulkAction(
        { ids: selectedAdminIds, action: bulkAction },
        admin.adminHeaders
      );
      setBulkPreview(preview);
      setBanner({ tone: preview.valid ? "success" : "warning", text: "Bulk action preview generated." });
    } catch (bulkError) {
      setBanner({
        tone: "warning",
        text: bulkError instanceof Error ? bulkError.message : "Failed to preview bulk action.",
      });
    }
  }

  async function handleBulkExecute() {
    if (!bulkPreview?.valid) {
      setBanner({ tone: "warning", text: "Run a valid preview before executing bulk changes." });
      return;
    }
    try {
      const result = await executeLearningMaterialBulkAction(
        {
          ids: selectedAdminIds,
          action: bulkAction,
          reason: "Bulk action confirmed from admin content management",
        },
        admin.adminHeaders
      );
      setBanner({ tone: "success", text: `Bulk action updated ${result.updated} item(s).` });
      setBulkPreview(null);
      setSelectedAdminIds([]);
      await refreshCurrentSelection();
    } catch (bulkError) {
      setBanner({
        tone: "warning",
        text: bulkError instanceof Error ? bulkError.message : "Failed to execute bulk action.",
      });
    }
  }

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Internal API"
      isLoading={loading}
      loadingMessage="Loading learning materials..."
    >
      {error ? <StatusBanner message={{ id: "resources-error", tone: "warning", text: error }} /> : null}
      {banner ? <StatusBanner message={{ id: "resources-banner", tone: banner.tone, text: banner.text }} /> : null}

      {adminMode && admin.unlocked ? (
        <p className="text-sm text-[var(--text-secondary)]">
          Admin publishing is enabled for this session.
        </p>
      ) : null}

      {adminMode && admin.unlocked && workflow ? (
        <SectionCard title="Admin Workflow Map">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
              <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">Lifecycle states</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {workflow.states.map((state) => (
                  <span key={state} className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                    {state}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
              <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">Bulk safety</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{workflow.bulkSafety.rollback}</p>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">Limit: {workflow.bulkSafety.maxItems} items per operation.</p>
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
      ) : null}

      <SectionCard title="Recommend a Resource">
        <form onSubmit={handleRecommendationSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Resource Title</label>
            <input
              required
              className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
              value={recommendationForm.title}
              onChange={(event) => setRecommendationForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="e.g. Unit 4 Important PYQs"
              aria-label="Resource Title"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Description</label>
            <textarea
              className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
              value={recommendationForm.description}
              rows={3}
              onChange={(event) =>
                setRecommendationForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Why this resource is useful for this subject."
              aria-label="Description"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Resource URL</label>
            <input
              required
              className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
              value={recommendationForm.url}
              onChange={(event) => setRecommendationForm((prev) => ({ ...prev, url: event.target.value }))}
              placeholder="https://..."
              aria-label="Resource URL"
            />
            <label className="mt-2 block text-xs text-[var(--text-secondary)]">Or upload a file</label>
            <input
              type="file"
              className="mt-1 block w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
              onChange={(event) => void handleRecommendationFileUpload(event.target.files?.[0] || null)}
            />
            {uploadingRecommendation ? (
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Uploading file...</p>
            ) : null}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Kind</label>
            <select
              className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
              value={recommendationForm.kind}
              onChange={(event) => setRecommendationForm((prev) => ({ ...prev, kind: event.target.value }))}
            >
              <option value="pdf">PDF</option>
              <option value="ppt">Presentation</option>
              <option value="video">Video</option>
              <option value="link">Web / YouTube Link</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Group</label>
            <select
              className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
              value={recommendationForm.resourceGroup}
              onChange={(event) =>
                setRecommendationForm((prev) => ({ ...prev, resourceGroup: event.target.value }))
              }
            >
              {RESOURCE_GROUPS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-[var(--comp-accent)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--comp-accent-hover)]"
            >
              Submit Recommendation
            </button>
          </div>
        </form>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title={advanced ? "Advanced Access Filters" : "Resource Browser"}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="resource-year" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                Year
              </label>
              <select
                id="resource-year"
                value={selectedYear ?? ""}
                onChange={(event) => {
                  const nextYear = Number(event.target.value || 0) || null;
                  setSelectedYear(nextYear);
                  if (nextYear !== null) {
                    void loadCatalog(nextYear);
                  }
                }}
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
                onChange={(event) => setSelectedCourseCode(event.target.value)}
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
                onChange={(event) => setSelectedSubjectCode(event.target.value)}
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
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by title, description, or tag"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
                />
              </div>
            ) : null}
          </div>
        </SectionCard>

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
      </div>

      {adminMode && admin.unlocked ? (
        <SectionCard title={editingId ? "Edit Resource" : "Publish Resource"}>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Resource Title</label>
              <input
                required
                className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="e.g. Unit 3 revision notes"
                aria-label="Resource Title"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Description</label>
              <textarea
                className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
                value={form.description}
                rows={3}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="What this resource covers and when to use it"
                aria-label="Description"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Resource URL</label>
              <input
                required
                className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
                value={form.url}
                onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
                placeholder="https://..."
                aria-label="Resource URL"
              />
              <label className="mt-2 block text-xs text-[var(--text-secondary)]">Or upload a file</label>
              <input
                type="file"
                className="mt-1 block w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                onChange={(event) => void handleMaterialFileUpload(event.target.files?.[0] || null)}
              />
              {uploadingResource ? (
                <p className="mt-1 text-xs text-[var(--text-secondary)]">Uploading file...</p>
              ) : null}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Kind</label>
              <select
                className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
                value={form.kind}
                onChange={(event) => setForm((prev) => ({ ...prev, kind: event.target.value }))}
              >
                <option value="pdf">PDF</option>
                <option value="ppt">Presentation</option>
                <option value="video">Video</option>
                <option value="link">YouTube / Web Link</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Group</label>
              <select
                className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
                value={form.resourceGroup}
                onChange={(event) => setForm((prev) => ({ ...prev, resourceGroup: event.target.value }))}
              >
                {RESOURCE_GROUPS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Visibility</label>
              <select
                className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
                value={form.visibility}
                onChange={(event) => setForm((prev) => ({ ...prev, visibility: event.target.value }))}
              >
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Tags</label>
              <input
                className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
                value={form.tags}
                onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder="revision, unit-3, high-priority"
                aria-label="Tags"
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input
                id="resource-featured"
                type="checkbox"
                checked={form.featured}
                onChange={(event) => setForm((prev) => ({ ...prev, featured: event.target.checked }))}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              <label htmlFor="resource-featured" className="text-sm text-[var(--text-primary)]">
                Mark as featured / priority resource
              </label>
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-xl bg-[var(--comp-accent)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--comp-accent-hover)]"
              >
                {editingId ? "Update Resource" : "Publish Resource"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId("");
                    setForm({
                      title: "",
                      description: "",
                      url: "",
                      kind: "pdf",
                      resourceGroup: "notes",
                      visibility: "visible",
                      featured: false,
                      tags: "",
                    });
                  }}
                  className="rounded-xl border border-[var(--border)] px-6 py-3 text-sm font-semibold text-[var(--text-secondary)] transition hover:border-[var(--comp-accent)] hover:text-[var(--comp-text-primary)]"
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard title={advanced ? "Advanced Resource Library" : "Resource Library"}>
        {libraryLoading ? (
          <p className="text-sm text-[var(--text-secondary)]">Loading resources for the selected subject...</p>
        ) : !library?.groups.length ? (
          <p className="text-sm text-[var(--text-secondary)]">
            No resources are available for the selected subject yet.
          </p>
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
                          <a
                            key={resource.id}
                            href={resource.urlOrPath}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--comp-text-primary)] transition hover:border-[var(--comp-accent)]"
                          >
                            Open {resource.kind.toUpperCase()}
                          </a>
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

      {adminMode && admin.unlocked && adminItems.length ? (
        <SectionCard title="Admin Resource Queue">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="admin-bulk-action" className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Bulk action</label>
                <select
                  id="admin-bulk-action"
                  value={bulkAction}
                  onChange={(event) => {
                    setBulkAction(event.target.value);
                    setBulkPreview(null);
                  }}
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                >
                  <option value="publish">Publish</option>
                  <option value="unpublish">Unpublish</option>
                  <option value="archive">Archive</option>
                  <option value="restore">Restore</option>
                  <option value="delete">Delete</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => void handleBulkPreview()}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-primary)] transition hover:bg-[var(--comp-surface-hover)]"
              >
                Preview Bulk Action
              </button>
              <button
                type="button"
                disabled={!bulkPreview?.valid}
                onClick={() => void handleBulkExecute()}
                className="rounded-lg bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)] disabled:opacity-50"
              >
                Execute Preview
              </button>
              <p className="text-sm text-[var(--text-secondary)]">{selectedAdminIds.length} selected</p>
            </div>
            {bulkPreview ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {bulkPreview.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                    <span className="font-semibold text-[var(--comp-text-primary)]">{item.title || item.id}</span>{" "}
                    {item.currentState} to {item.nextState} · {item.valid ? "valid" : item.reason || "invalid"}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="space-y-3">
            {adminItems.map((item) => {
              const primaryResource = item.resources[0];
              return (
                <div key={item.id} className="rounded-2xl border border-[var(--border)] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${item.title}`}
                        checked={selectedAdminIds.includes(item.id)}
                        onChange={() => toggleAdminSelection(item.id)}
                        className="mt-1 h-4 w-4 rounded border-[var(--border)]"
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">{item.title}</h3>
                          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
                            {item.lifecycleState || "published"}
                          </span>
                        </div>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.description}</p>
                      <p className="mt-2 text-xs text-[var(--text-secondary)]">
                        Group: {String(item.metadata?.resourceGroup || "links")} · Visibility:{" "}
                        {String(item.metadata?.visibility || "visible")} · Version {item.version || 1} · Last actor{" "}
                        {item.lastActor || "system"}
                      </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(item.id);
                          setForm({
                            title: item.title,
                            description: item.description || "",
                            url: primaryResource?.urlOrPath || "",
                            kind: primaryResource?.kind || "pdf",
                            resourceGroup: String(item.metadata?.resourceGroup || "notes"),
                            visibility: String(item.metadata?.visibility || "visible"),
                            featured: Boolean(item.metadata?.featured),
                            tags: Array.isArray(item.metadata?.tags) ? item.metadata.tags.join(", ") : "",
                          });
                        }}
                        className="rounded-full border border-[color-mix(in_srgb,var(--info)_30%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--info)] transition hover:bg-[color-mix(in_srgb,var(--info)_10%,transparent)]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void updateLearningMaterialItem(
                            item.id,
                            {
                              title: item.title,
                              description: item.description,
                              metadata: {
                                ...(item.metadata || {}),
                                visibility:
                                  String(item.metadata?.visibility || "visible") === "hidden"
                                    ? "visible"
                                    : "hidden",
                              },
                              resources: item.resources.map((resource) => ({
                                kind: resource.kind,
                                title: resource.title,
                                url_or_path: resource.urlOrPath,
                              })),
                            },
                            admin.adminHeaders
                          )
                            .then(() => {
                              setBanner({ tone: "success", text: "Resource visibility updated." });
                              return refreshCurrentSelection();
                            })
                            .catch((updateError) =>
                              setBanner({
                                tone: "warning",
                                text:
                                  updateError instanceof Error
                                    ? updateError.message
                                    : "Failed to update visibility.",
                              })
                            )
                        }
                        className="rounded-full border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--warning)] transition hover:bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]"
                      >
                        {String(item.metadata?.visibility || "visible") === "hidden" ? "Unhide" : "Hide"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleLifecycleAction(item.id, "publish")}
                        className="rounded-full border border-[color-mix(in_srgb,var(--success)_30%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--success)] transition hover:bg-[color-mix(in_srgb,var(--success)_10%,transparent)]"
                      >
                        Publish
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleLifecycleAction(item.id, "unpublish")}
                        className="rounded-full border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--warning)] transition hover:bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]"
                      >
                        Unpublish
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleLifecycleAction(item.id, "archive")}
                        className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--comp-surface-hover)]"
                      >
                        Archive
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleLifecycleAction(item.id, "restore")}
                        className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--comp-surface-hover)]"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleHistory(item.id)}
                        className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--comp-text-primary)] transition hover:bg-[var(--comp-surface-hover)]"
                      >
                        History
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void deleteLearningMaterialItem(item.id, admin.adminHeaders)
                            .then(() => {
                              setBanner({ tone: "success", text: "Resource moved to deleted state." });
                              return refreshCurrentSelection();
                            })
                            .catch((deleteError) =>
                              setBanner({
                                tone: "warning",
                                text:
                                  deleteError instanceof Error
                                    ? deleteError.message
                                    : "Failed to delete resource.",
                              })
                            )
                        }
                        className="rounded-full border border-[color-mix(in_srgb,var(--error)_30%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--error)] transition hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {historyOpenId === item.id ? (
                    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--comp-surface)] p-3">
                      <h4 className="text-sm font-semibold text-[var(--comp-text-primary)]">Change history and diff</h4>
                      {historyItems.length ? (
                        <div className="mt-2 space-y-2">
                          {historyItems.slice(0, 4).map((entry) => (
                            <div key={entry.id} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs">
                              <div className="font-semibold text-[var(--comp-text-primary)]">
                                {entry.action} by {entry.actorId}
                              </div>
                              <div className="text-[var(--text-secondary)]">{entry.reason || "No reason recorded."}</div>
                              <div className="mt-1 text-[var(--text-secondary)]">
                                {Object.keys(entry.diff || {}).join(", ") || "No field diff recorded"}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">No audit entries found.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </SectionCard>
      ) : null}

      {adminMode && admin.unlocked ? (
        <SectionCard title="Resource Recommendation Queue">
          {recommendations.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">No recommendations yet.</p>
          ) : (
            <div className="space-y-3">
              {recommendations.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[var(--border)] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">{item.title}</h3>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.description}</p>
                      <p className="mt-2 text-xs text-[var(--text-secondary)]">
                        Status: {String(item.metadata?.status || "pending")} · Suggested by{" "}
                        {String(item.metadata?.recommenderName || "student")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void reviewResourceRecommendation(
                            item.id,
                            { status: "approved", reviewerNotes: "Approved by admin" },
                            admin.adminHeaders
                          )
                            .then(() => {
                              setBanner({ tone: "success", text: "Recommendation approved." });
                              return refreshCurrentSelection();
                            })
                            .catch((reviewError) =>
                              setBanner({
                                tone: "warning",
                                text: reviewError instanceof Error ? reviewError.message : "Failed to approve.",
                              })
                            )
                        }
                        className="rounded-full border border-[color-mix(in_srgb,var(--success)_30%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--success)] transition hover:bg-[color-mix(in_srgb,var(--success)_10%,transparent)]"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void reviewResourceRecommendation(
                            item.id,
                            { status: "rejected", reviewerNotes: "Not aligned with syllabus currently" },
                            admin.adminHeaders
                          )
                            .then(() => {
                              setBanner({ tone: "success", text: "Recommendation rejected." });
                              return refreshCurrentSelection();
                            })
                            .catch((reviewError) =>
                              setBanner({
                                tone: "warning",
                                text: reviewError instanceof Error ? reviewError.message : "Failed to reject.",
                              })
                            )
                        }
                        className="rounded-full border border-[color-mix(in_srgb,var(--error)_30%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--error)] transition hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}
    </ErpPageShell>
  );
}
