import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminContentManagementPage from "./AdminContentManagementPage";

const mocks = vi.hoisted(() => ({
  adminHeaders: { "x-admin-password": "test" },
  getContentWorkflow: vi.fn(),
  getLearningMaterialCatalog: vi.fn(),
  getLearningMaterialSubjects: vi.fn(),
  getLearningMaterialLibrary: vi.fn(),
  listAdminLearningMaterialItems: vi.fn(),
  listResourceRecommendations: vi.fn(),
  previewLearningMaterialBulkAction: vi.fn(),
  executeLearningMaterialBulkAction: vi.fn(),
  getLearningMaterialHistory: vi.fn(),
}));

vi.mock("../../hooks/useAdminAccess", () => ({
  useAdminAccess: () => ({
    unlocked: true,
    adminHeaders: mocks.adminHeaders,
    password: "",
    setPassword: vi.fn(),
    busy: false,
    error: "",
    unlock: vi.fn(),
    lock: vi.fn(),
  }),
}));

vi.mock("../../lib/lms/index", async () => {
  const actual = await vi.importActual<typeof import("../../lib/lms/index")>("../../lib/lms/index");
  return {
    ...actual,
    getContentWorkflow: mocks.getContentWorkflow,
    getLearningMaterialCatalog: mocks.getLearningMaterialCatalog,
    getLearningMaterialSubjects: mocks.getLearningMaterialSubjects,
    getLearningMaterialLibrary: mocks.getLearningMaterialLibrary,
    listAdminLearningMaterialItems: mocks.listAdminLearningMaterialItems,
    listResourceRecommendations: mocks.listResourceRecommendations,
    previewLearningMaterialBulkAction: mocks.previewLearningMaterialBulkAction,
    executeLearningMaterialBulkAction: mocks.executeLearningMaterialBulkAction,
    getLearningMaterialHistory: mocks.getLearningMaterialHistory,
    createResourceRecommendation: vi.fn(),
    createLearningMaterialItem: vi.fn(),
    updateLearningMaterialItem: vi.fn(),
    deleteLearningMaterialItem: vi.fn(),
    reviewResourceRecommendation: vi.fn(),
    uploadResourceFile: vi.fn(),
  };
});

describe("AdminContentManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    mocks.getContentWorkflow.mockResolvedValue({
      states: ["draft", "review", "published", "unpublished", "archived", "deleted"],
      transitions: [
        { action: "publish", label: "Publish", from: ["draft", "review"], to: "published" },
        { action: "archive", label: "Archive", from: ["published"], to: "archived", requiresReason: true },
      ],
      permissions: { admin: ["publish", "archive"] },
      bulkSafety: {
        previewRequired: true,
        maxItems: 200,
        rollback: "Bulk execution runs in one SQLite transaction after preview validation.",
      },
    });
    mocks.getLearningMaterialCatalog.mockResolvedValue({
      years: [2],
      selectedYear: 2,
      courses: [{ year: 2, courseCode: "CSE", courseName: "Computer Science", subjectCount: 1, resourceCount: 1 }],
    });
    mocks.getLearningMaterialSubjects.mockResolvedValue({
      year: 2,
      courseCode: "CSE",
      subjects: [{ subjectCode: "CSE304", subjectName: "Operating Systems", semester: 4, groups: ["notes"], resourceCount: 1 }],
    });
    const item = {
      id: "content-1",
      type: "learning_material",
      title: "Operating Systems Revision Notes",
      description: "Scheduler notes.",
      lifecycleState: "published",
      version: 2,
      lastActor: "admin",
      metadata: { resourceGroup: "notes", visibility: "visible", tags: ["os"] },
      resources: [{ id: "res-1", contentId: "content-1", kind: "pdf", title: "OS Notes", urlOrPath: "https://example.com/os.pdf" }],
    };
    mocks.getLearningMaterialLibrary.mockResolvedValue({
      subject: { year: 2, courseCode: "CSE", courseName: "Computer Science", subjectCode: "CSE304", subjectName: "Operating Systems", semester: 4 },
      groups: [{ group: "notes", label: "Notes", items: [item] }],
      totalItems: 1,
      totalResources: 1,
    });
    mocks.listAdminLearningMaterialItems.mockResolvedValue({ items: [item] });
    mocks.listResourceRecommendations.mockResolvedValue({ items: [] });
    mocks.previewLearningMaterialBulkAction.mockResolvedValue({
      action: "archive",
      valid: true,
      invalidCount: 0,
      items: [{ id: "content-1", title: "Operating Systems Revision Notes", currentState: "published", nextState: "archived", valid: true }],
    });
    mocks.executeLearningMaterialBulkAction.mockResolvedValue({ action: "archive", updated: 1, items: [] });
    mocks.getLearningMaterialHistory.mockResolvedValue({
      items: [
        {
          id: "audit-1",
          contentId: "content-1",
          action: "edit",
          actorId: "admin",
          actorRole: "admin",
          reason: "Title clarified",
          before: {},
          after: {},
          diff: { title: { before: "OS Notes", after: "Operating Systems Revision Notes" } },
          createdAt: "2026-05-26T09:00:00.000Z",
        },
      ],
    });
  });

  it("renders lifecycle workflow, previews bulk actions, executes after preview, and shows audit diff", async () => {
    render(<AdminContentManagementPage />);

    expect(await screen.findByText("Admin Workflow Map")).toBeInTheDocument();
    expect(screen.getByText("Lifecycle states")).toBeInTheDocument();
    expect((await screen.findAllByText("Operating Systems Revision Notes")).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByLabelText("Select Operating Systems Revision Notes"));
    await userEvent.selectOptions(screen.getByLabelText("Bulk action"), "archive");
    await userEvent.click(screen.getByRole("button", { name: "Preview Bulk Action" }));

    await waitFor(() => expect(mocks.previewLearningMaterialBulkAction).toHaveBeenCalledWith(
      { ids: ["content-1"], action: "archive" },
      { "x-admin-password": "test" }
    ));
    expect((await screen.findAllByText(/published to archived/i)).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "Execute Preview" }));
    await waitFor(() => expect(mocks.executeLearningMaterialBulkAction).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("button", { name: "History" }));
    expect(await screen.findByText("Change history and diff")).toBeInTheDocument();
    expect(screen.getByText(/Title clarified/i)).toBeInTheDocument();
    expect(screen.getAllByText(/title/i).length).toBeGreaterThan(0);
  });
});
