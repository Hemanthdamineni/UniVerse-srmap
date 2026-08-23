import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ErpPageShell, SectionCard, StatusBanner } from "../../components/erp/ErpPrimitives";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import {
  createLearningMaterialItem,
  deleteLearningMaterialItem,
  executeLearningMaterialBulkAction,
  getLearningMaterialHistory,
  previewLearningMaterialBulkAction,
  reviewResourceRecommendation,
  transitionLearningMaterialLifecycle,
  updateLearningMaterialItem,
  uploadResourceFile,
} from "../../lib/lms/index";
import { AdminResourceQueue, RecommendationQueue } from "./learningMaterials/adminSections";
import { EMPTY_MATERIAL_FORM, inferUploadedResourceKind } from "./learningMaterials/constants";
import { MaterialForm } from "./learningMaterials/forms";
import { ResourceFilters, ResourceLibrary, ResourcePreview, WorkflowMap } from "./learningMaterials/sections";
import { useLearningMaterialsData } from "./learningMaterials/useLearningMaterialsData";
import type {
  AdminLearningResourceItem,
  BannerState,
  MaterialFormState,
} from "./learningMaterials/types";

type Props = {
  blueprint: PageBlueprint;
  advanced?: boolean;
  adminMode?: boolean;
};

type UploadedResource = Awaited<ReturnType<typeof uploadResourceFile>>;

export default function LearningMaterialsPage({ blueprint, advanced = false, adminMode = false }: Props) {
  const admin = useAdminAccess();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState("");
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [uploadingResource, setUploadingResource] = useState(false);
  const [form, setForm] = useState<MaterialFormState>(() => ({ ...EMPTY_MATERIAL_FORM }));
  const data = useLearningMaterialsData({
    adminMode,
    adminUnlocked: admin.unlocked,
    adminHeaders: admin.adminHeaders,
    advanced,
    search,
  });
  const {
    adminItems,
    bulkAction,
    bulkPreview,
    catalog,
    coursesForYear,
    error,
    historyItems,
    historyOpenId,
    library,
    libraryLoading,
    loadCatalog,
    loading,
    previewUrl,
    recommendations,
    refreshCurrentSelection,
    selectedAdminIds,
    selectedCourse,
    selectedCourseCode,
    selectedSubject,
    selectedSubjectCode,
    selectedYear,
    setBulkAction,
    setBulkPreview,
    setHistoryItems,
    setHistoryOpenId,
    setPreviewUrl,
    setSelectedAdminIds,
    setSelectedCourseCode,
    setSelectedSubjectCode,
    setSelectedYear,
    subjects,
    workflow,
  } = data;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedYear || !selectedCourse || !selectedSubject) return;
    setBanner(null);

    if (!form.url.trim()) {
      setBanner({ tone: "warning", text: "Provide a URL or upload a file first." });
      return;
    }

    try {
      if (editingId) {
        await updateLearningMaterialItem(editingId, buildMaterialPayload(), admin.adminHeaders);
        setBanner({ tone: "success", text: "Resource updated successfully." });
      } else {
        await createLearningMaterialItem(buildMaterialPayload(), admin.adminHeaders);
        setBanner({ tone: "success", text: "Resource published successfully." });
      }
      cancelEdit();
      await refreshCurrentSelection();
    } catch (submitError) {
      setBanner({ tone: "warning", text: errorMessage(submitError, "Failed to save resource.") });
    }
  }

  function buildMaterialPayload() {
    return {
      title: form.title.trim(),
      description: form.description.trim(),
      category: selectedCourse!.courseCode,
      metadata: {
        year: selectedYear,
        courseCode: selectedCourse!.courseCode,
        courseName: selectedCourse!.courseName,
        subjectCode: selectedSubject!.subjectCode,
        subjectName: selectedSubject!.subjectName,
        semester: selectedSubject!.semester,
        resourceGroup: form.resourceGroup,
        visibility: form.visibility,
        featured: form.featured,
        tags: form.tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      },
      resources: [{ kind: form.kind, title: form.title.trim(), url_or_path: form.url.trim() }],
    };
  }

  async function uploadIntoForm(
    file: File | null,
    setUploading: (uploading: boolean) => void,
    applyUpload: (uploaded: UploadedResource) => void
  ) {
    if (!file) return;
    setUploading(true);
    setBanner(null);
    try {
      const uploaded = await uploadResourceFile(file);
      applyUpload(uploaded);
      setBanner({ tone: "success", text: `Uploaded ${uploaded.fileName}.` });
    } catch (uploadError) {
      setBanner({ tone: "warning", text: errorMessage(uploadError, "Failed to upload file.") });
    } finally {
      setUploading(false);
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
      setBanner({ tone: "warning", text: errorMessage(lifecycleError, "Lifecycle action failed.") });
    }
  }

  async function handleHistory(contentId: string) {
    try {
      const response = await getLearningMaterialHistory(contentId, admin.adminHeaders);
      setHistoryOpenId(contentId);
      setHistoryItems(response.items || []);
    } catch (historyError) {
      setBanner({ tone: "warning", text: errorMessage(historyError, "Failed to load change history.") });
    }
  }

  async function handleBulkPreview() {
    if (!selectedAdminIds.length) {
      setBanner({ tone: "warning", text: "Select at least one resource for bulk action preview." });
      return;
    }
    try {
      const preview = await previewLearningMaterialBulkAction({ ids: selectedAdminIds, action: bulkAction }, admin.adminHeaders);
      setBulkPreview(preview);
      setBanner({ tone: preview.valid ? "success" : "warning", text: "Bulk action preview generated." });
    } catch (bulkError) {
      setBanner({ tone: "warning", text: errorMessage(bulkError, "Failed to preview bulk action.") });
    }
  }

  async function handleBulkExecute() {
    if (!bulkPreview?.valid) {
      setBanner({ tone: "warning", text: "Run a valid preview before executing bulk changes." });
      return;
    }
    try {
      const result = await executeLearningMaterialBulkAction(
        { ids: selectedAdminIds, action: bulkAction, reason: "Bulk action confirmed from admin content management" },
        admin.adminHeaders
      );
      setBanner({ tone: "success", text: `Bulk action updated ${result.updated} item(s).` });
      setBulkPreview(null);
      setSelectedAdminIds([]);
      await refreshCurrentSelection();
    } catch (bulkError) {
      setBanner({ tone: "warning", text: errorMessage(bulkError, "Failed to execute bulk action.") });
    }
  }

  function beginEdit(item: AdminLearningResourceItem) {
    const primaryResource = item.resources[0];
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
  }

  function cancelEdit() {
    setEditingId("");
    setForm({ ...EMPTY_MATERIAL_FORM });
  }

  async function toggleVisibility(item: AdminLearningResourceItem) {
    try {
      await updateLearningMaterialItem(
        item.id,
        {
          title: item.title,
          description: item.description,
          metadata: {
            ...(item.metadata || {}),
            visibility: String(item.metadata?.visibility || "visible") === "hidden" ? "visible" : "hidden",
          },
          resources: item.resources.map((resource) => ({
            kind: resource.kind,
            title: resource.title,
            url_or_path: resource.urlOrPath,
          })),
        },
        admin.adminHeaders
      );
      setBanner({ tone: "success", text: "Resource visibility updated." });
      await refreshCurrentSelection();
    } catch (updateError) {
      setBanner({ tone: "warning", text: errorMessage(updateError, "Failed to update visibility.") });
    }
  }

  async function deleteItem(contentId: string) {
    try {
      await deleteLearningMaterialItem(contentId, admin.adminHeaders);
      setBanner({ tone: "success", text: "Resource moved to deleted state." });
      await refreshCurrentSelection();
    } catch (deleteError) {
      setBanner({ tone: "warning", text: errorMessage(deleteError, "Failed to delete resource.") });
    }
  }

  async function reviewRecommendation(contentId: string, status: "approved" | "rejected") {
    try {
      await reviewResourceRecommendation(
        contentId,
        {
          status,
          reviewerNotes: status === "approved" ? "Approved by admin" : "Not aligned with syllabus currently",
        },
        admin.adminHeaders
      );
      setBanner({ tone: "success", text: `Recommendation ${status}.` });
      await refreshCurrentSelection();
    } catch (reviewError) {
      setBanner({ tone: "warning", text: errorMessage(reviewError, `Failed to ${status}.`) });
    }
  }

  return (
    <ErpPageShell title={blueprint.heading} source="Internal API" isLoading={loading} loadingMessage="Loading learning materials...">
      {error ? <StatusBanner message={{ id: "resources-error", tone: "warning", text: error }} /> : null}
      {banner ? <StatusBanner message={{ id: "resources-banner", tone: banner.tone, text: banner.text }} /> : null}

      {adminMode && admin.unlocked ? (
        <p className="text-sm text-[var(--text-secondary)]">Admin publishing is enabled for this session.</p>
      ) : null}

      {adminMode && admin.unlocked && workflow ? <WorkflowMap workflow={workflow} /> : null}

      {!adminMode ? (
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--comp-accent)_22%,var(--border))] bg-[var(--comp-surface)] px-3 py-2 text-sm text-[var(--text-secondary)]">
          Looking to share your own notes, PYQs, or links? Use{" "}
          <Link to="/resources/add" className="font-medium text-[var(--info)] underline underline-offset-2">
            Contribute Resource
          </Link>{" "}
          — submissions go through peer review and appear in the community catalog.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <ResourceFilters
          advanced={advanced}
          catalog={catalog}
          coursesForYear={coursesForYear}
          subjects={subjects}
          selectedYear={selectedYear}
          selectedCourseCode={selectedCourseCode}
          selectedSubjectCode={selectedSubjectCode}
          search={search}
          onYearChange={(nextYear) => {
            setSelectedYear(nextYear);
            if (nextYear !== null) void loadCatalog(nextYear);
          }}
          onCourseChange={setSelectedCourseCode}
          onSubjectChange={setSelectedSubjectCode}
          onSearchChange={setSearch}
        />
        <ResourcePreview previewUrl={previewUrl} />
      </div>

      {adminMode && admin.unlocked ? (
        <SectionCard title={editingId ? "Edit Resource" : "Publish Resource"}>
          <MaterialForm
            form={form}
            editingId={editingId}
            uploading={uploadingResource}
            onChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
            onSubmit={handleSubmit}
            onCancelEdit={cancelEdit}
            onFileUpload={(file) =>
              void uploadIntoForm(file, setUploadingResource, (uploaded) =>
                setForm((prev) => ({
                  ...prev,
                  url: uploaded.url,
                  kind: inferUploadedResourceKind(uploaded),
                }))
              )
            }
          />
        </SectionCard>
      ) : null}

      <ResourceLibrary
        advanced={advanced}
        libraryLoading={libraryLoading}
        library={library}
        onPreviewResource={setPreviewUrl}
      />

      {adminMode && admin.unlocked ? (
        <>
          <AdminResourceQueue
            adminItems={adminItems}
            selectedAdminIds={selectedAdminIds}
            bulkAction={bulkAction}
            bulkPreview={bulkPreview}
            historyOpenId={historyOpenId}
            historyItems={historyItems}
            onToggleSelection={toggleAdminSelection}
            onBulkActionChange={(action) => {
              setBulkAction(action);
              setBulkPreview(null);
            }}
            onBulkPreview={() => void handleBulkPreview()}
            onBulkExecute={() => void handleBulkExecute()}
            onEdit={beginEdit}
            onToggleVisibility={(item) => void toggleVisibility(item)}
            onLifecycleAction={(contentId, action) => void handleLifecycleAction(contentId, action)}
            onHistory={(contentId) => void handleHistory(contentId)}
            onDelete={(contentId) => void deleteItem(contentId)}
          />
          <RecommendationQueue
            recommendations={recommendations}
            onReview={(contentId, status) => void reviewRecommendation(contentId, status)}
          />
        </>
      ) : null}
    </ErpPageShell>
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
