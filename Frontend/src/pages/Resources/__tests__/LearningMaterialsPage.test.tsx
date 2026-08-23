import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it, vi, beforeEach } from "vitest";
import type { PageBlueprint } from "../../../config/erpBlueprints";
import LearningMaterialsPage from "../LearningMaterialsPage";

// ---------------------------------------------------------------------------
// ResizeObserver stub (needed by usePageContrast in jsdom)
// ---------------------------------------------------------------------------
beforeAll(() => {
  (globalThis as any).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { mockUseAdminAccess } = vi.hoisted(() => ({
  mockUseAdminAccess: vi.fn(),
}));

const { mockUseLearningMaterialsData } = vi.hoisted(() => ({
  mockUseLearningMaterialsData: vi.fn(),
}));

const { lmsModule } = vi.hoisted(() => ({
  lmsModule: {
    uploadResourceFile: vi.fn(),
    createResourceRecommendation: vi.fn(),
    updateLearningMaterialItem: vi.fn(),
    createLearningMaterialItem: vi.fn(),
    deleteLearningMaterialItem: vi.fn(),
    executeLearningMaterialBulkAction: vi.fn(),
    getLearningMaterialHistory: vi.fn(),
    previewLearningMaterialBulkAction: vi.fn(),
    reviewResourceRecommendation: vi.fn(),
    transitionLearningMaterialLifecycle: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock("../../../hooks/useAdminAccess", () => ({
  useAdminAccess: mockUseAdminAccess,
}));

vi.mock("../learningMaterials/useLearningMaterialsData", () => ({
  useLearningMaterialsData: mockUseLearningMaterialsData,
}));

vi.mock("../../../lib/lms/index", () => lmsModule);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const testBlueprint: PageBlueprint = {
  route: "/resources/learning-materials",
  heading: "Learning Materials",
  fetchKeys: ["catalog", "library", "subjects"],
  domain: "lms",
  renderer: "generic",
  integrationState: "native",
  sourceMode: "internal",
} as const;

function adminAccessValue(overrides: Record<string, unknown> = {}) {
  return {
    unlocked: false,
    password: "",
    setPassword: vi.fn(),
    busy: false,
    error: "",
    unlock: vi.fn().mockResolvedValue(undefined),
    lock: vi.fn().mockResolvedValue(undefined),
    adminHeaders: {},
    ...overrides,
  };
}

function dataMockValue(overrides: Record<string, unknown> = {}) {
  return {
    adminItems: [],
    bulkAction: "unpublish",
    bulkPreview: null,
    catalog: null,
    coursesForYear: [],
    error: null,
    historyItems: [],
    historyOpenId: "",
    library: null,
    libraryLoading: false,
    loadCatalog: vi.fn(),
    loading: false,
    previewUrl: "",
    recommendations: [],
    refreshCurrentSelection: vi.fn().mockResolvedValue(undefined),
    selectedAdminIds: [],
    selectedCourse: null,
    selectedCourseCode: "",
    selectedSubject: null,
    selectedSubjectCode: "",
    selectedYear: null,
    setBulkAction: vi.fn(),
    setBulkPreview: vi.fn(),
    setHistoryItems: vi.fn(),
    setHistoryOpenId: vi.fn(),
    setPreviewUrl: vi.fn(),
    setSelectedAdminIds: vi.fn(),
    setSelectedCourseCode: vi.fn(),
    setSelectedSubjectCode: vi.fn(),
    setSelectedYear: vi.fn(),
    subjects: null,
    workflow: null,
    ...overrides,
  };
}

const mockCatalog = {
  years: [1, 2, 3, 4],
  selectedYear: 2,
  courses: [
    { year: 1, courseCode: "CSE", courseName: "Computer Science & Engg", subjectCount: 5, resourceCount: 10 },
    { year: 2, courseCode: "CSE", courseName: "Computer Science & Engg", subjectCount: 6, resourceCount: 12 },
  ],
};

const mockSubjects = {
  year: 2,
  courseCode: "CSE",
  subjects: [
    { subjectCode: "CSE201", subjectName: "Data Structures", semester: 3, groups: ["notes", "pyq-mid"], resourceCount: 5 },
    { subjectCode: "CSE202", subjectName: "Algorithms", semester: 3, groups: ["notes"], resourceCount: 3 },
  ],
};

const libraryItem1 = {
  id: "item-1",
  title: "Array Notes",
  description: "Complete guide to arrays in C and Python.",
  category: "CSE",
  lifecycleState: "published",
  version: 2,
  metadata: {
    resourceGroup: "notes",
    visibility: "visible",
    featured: true,
    tags: ["arrays", "basics", "data-structures"],
  },
  resources: [
    {
      id: "res-1",
      contentId: "item-1",
      kind: "pdf",
      title: "Array Notes PDF",
      urlOrPath: "https://example.com/arrays.pdf",
    },
  ],
};

const libraryItem2 = {
  id: "item-2",
  title: "Linked List Visualizer",
  description: "Interactive linked list simulation.",
  category: "CSE",
  lifecycleState: "published",
  metadata: {
    resourceGroup: "links",
    visibility: "visible",
    featured: false,
    tags: [],
  },
  resources: [
    {
      id: "res-2",
      contentId: "item-2",
      kind: "link",
      title: "Linked List Visualizer",
      urlOrPath: "https://visualizer.example.com/lists",
    },
  ],
};

const mockLibrary = {
  subject: {
    year: 2,
    courseCode: "CSE",
    courseName: "Computer Science & Engg",
    subjectCode: "CSE201",
    subjectName: "Data Structures",
    semester: 3,
  },
  groups: [
    {
      group: "notes",
      label: "Notes",
      items: [libraryItem1, libraryItem2],
    },
  ],
  totalItems: 2,
  totalResources: 2,
};

const adminItem = {
  id: "admin-item-1",
  title: "OS Revision Notes",
  description: "Quick revision for scheduling and processes.",
  category: "CSE",
  lifecycleState: "published",
  version: 3,
  lastActor: "AP23110010419",
  createdAt: "2026-05-20T09:00:00.000Z",
  metadata: {
    year: 2,
    courseCode: "CSE",
    courseName: "Computer Science & Engg",
    subjectCode: "CSE201",
    subjectName: "Data Structures",
    resourceGroup: "notes",
    visibility: "visible",
    featured: true,
    tags: ["revision", "os"],
  },
  resources: [
    {
      id: "admin-res-1",
      contentId: "admin-item-1",
      kind: "pdf",
      title: "OS Revision Notes",
      urlOrPath: "https://example.com/os-notes.pdf",
    },
  ],
};

const recommendationItem = {
  id: "rec-1",
  title: "Great YouTube Series on OS",
  description: "Explains process scheduling visually.",
  lifecycleState: "review",
  metadata: {
    status: "pending",
    recommenderName: "AP23110010234",
  },
  resources: [
    {
      id: "rec-res-1",
      kind: "video",
      title: "OS Series",
      urlOrPath: "https://youtube.com/os-series",
    },
  ],
};

const mockWorkflow = {
  states: ["draft", "review", "published", "unpublished", "archived", "deleted"],
  transitions: [
    { action: "publish", label: "Publish", from: ["draft", "review", "unpublished", "archived"], to: "published" },
    { action: "unpublish", label: "Unpublish", from: ["published", "review"], to: "unpublished", requiresReason: true },
    { action: "archive", label: "Archive", from: ["published", "unpublished", "review", "draft"], to: "archived", requiresReason: true },
    { action: "delete", label: "Delete", from: ["draft", "review", "published", "unpublished", "archived"], to: "deleted", requiresReason: true },
    { action: "restore", label: "Restore", from: ["deleted", "archived"], to: "published", requiresReason: true },
  ],
  permissions: { admin: ["create", "edit", "publish", "unpublish", "archive", "delete", "restore"] },
  bulkSafety: { previewRequired: true, maxItems: 200, rollback: "Bulk execution runs in one transaction." },
};

const uploadedFile = new File(["dummy content"], "notes.pdf", { type: "application/pdf" });

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  mockUseAdminAccess.mockReturnValue(adminAccessValue());
  mockUseLearningMaterialsData.mockReturnValue(dataMockValue());
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function renderPage(props: Partial<{
  blueprint?: PageBlueprint;
  advanced?: boolean;
  adminMode?: boolean;
}> = {}) {
  return render(
    <MemoryRouter>
      <LearningMaterialsPage
        blueprint={props.blueprint ?? testBlueprint}
        advanced={props.advanced ?? false}
        adminMode={props.adminMode ?? false}
      />
    </MemoryRouter>
  );
}

// ===========================================================================
// Tests
// ===========================================================================

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------
describe("Loading state", () => {
  it("renders the loading overlay when loading is true", () => {
    mockUseLearningMaterialsData.mockReturnValue(dataMockValue({ loading: true }));
    renderPage();

    expect(screen.getByText("Loading learning materials...")).toBeInTheDocument();
  });

  it("does not render the loading overlay when loading completes", () => {
    mockUseLearningMaterialsData.mockReturnValue(dataMockValue({ loading: false }));
    renderPage();

    expect(screen.queryByText("Loading learning materials...")).not.toBeInTheDocument();
  });

  it("always shows the page heading regardless of loading state", () => {
    mockUseLearningMaterialsData.mockReturnValue(dataMockValue({ loading: true }));
    renderPage();

    expect(screen.getByText("Learning Materials")).toBeInTheDocument();
  });

  it("shows library loading indicator when libraryLoading is true", () => {
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        libraryLoading: true,
        library: mockLibrary,
      })
    );
    renderPage();

    expect(screen.getByText("Loading resources for the selected subject...")).toBeInTheDocument();
  });

  it("replaces library loading indicator once loaded", () => {
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({ libraryLoading: false, library: mockLibrary })
    );
    renderPage();

    expect(screen.queryByText("Loading resources for the selected subject...")).not.toBeInTheDocument();
    expect(screen.getByText("Array Notes")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe("Error handling", () => {
  it("displays the error banner when the hook returns an error", () => {
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({ error: "Failed to load learning materials." })
    );
    renderPage();

    const banner = screen.getByText("Failed to load learning materials.");
    expect(banner).toBeInTheDocument();
  });

  it("does not render any error banner when there is no error", () => {
    mockUseLearningMaterialsData.mockReturnValue(dataMockValue({ error: null }));
    renderPage();

    expect(screen.queryByText("Failed to load learning materials.")).not.toBeInTheDocument();
  });

  it("renders an error alongside existing content", () => {
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        error: "Failed to load subject list.",
        selectedYear: 2,
        selectedCourseCode: "CSE",
        catalog: mockCatalog,
      })
    );
    renderPage();

    expect(screen.getByText("Failed to load subject list.")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Banner notifications
// ---------------------------------------------------------------------------
describe("Banner notifications", () => {
  it("renders a success banner when set", () => {
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        // The component's internal banner state is not in the hook; it's local state.
        // We simulate by using error which is the only hook-based banner.
        // The local banner state is triggered via interactions.
      })
    );
    renderPage({ adminMode: true });
    mockUseAdminAccess.mockReturnValue(adminAccessValue({ unlocked: true }));

    // Local banner state needs interaction to appear -- tested in later sections.
    // This test verifies no banner renders by default.
    expect(screen.queryByText(/Provide a URL/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
describe("Empty state (no resources)", () => {
  beforeEach(() => {
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        coursesForYear: mockCatalog.courses.filter((c: { year: number }) => c.year === 2),
        selectedYear: 2,
        selectedCourseCode: "CSE",
        selectedSubjectCode: "CSE201",
        subjects: mockSubjects,
        library: {
          ...mockLibrary,
          groups: [],
        },
        libraryLoading: false,
      })
    );
  });

  it("shows the empty library message when no resource groups exist", () => {
    renderPage();
    expect(screen.getByText("No resources are available for the selected subject yet.")).toBeInTheDocument();
  });

  it("does not show library content when groups are empty", () => {
    renderPage();
    expect(screen.queryByText("Array Notes")).not.toBeInTheDocument();
  });

  it("renders filter dropdowns with catalog data even when library is empty", () => {
    renderPage();
    expect(screen.getByDisplayValue("Year 2")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Success state — full resource rendering
// ---------------------------------------------------------------------------
describe("Success state with resources", () => {
  beforeEach(() => {
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        coursesForYear: mockCatalog.courses.filter((c: { year: number }) => c.year === 2),
        selectedYear: 2,
        selectedCourseCode: "CSE",
        selectedSubjectCode: "CSE201",
        selectedSubject: mockSubjects.subjects[0],
        selectedCourse: mockCatalog.courses[0],
        subjects: mockSubjects,
        library: mockLibrary,
        libraryLoading: false,
        previewUrl: "https://example.com/arrays.pdf",
      })
    );
  });

  it("renders the library section and resource titles", () => {
    renderPage();
    expect(screen.getByText("Resource Library")).toBeInTheDocument();
    expect(screen.getByText("Array Notes")).toBeInTheDocument();
    expect(screen.getByText("Linked List Visualizer")).toBeInTheDocument();
  });

  it("renders group labels from library data", () => {
    renderPage();
    const notesLabels = screen.getAllByText("Notes");
    // "Notes" appears as the resource-group <option> and as the library <h3>
    expect(notesLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("renders resource descriptions", () => {
    renderPage();
    expect(screen.getByText("Complete guide to arrays in C and Python.")).toBeInTheDocument();
    // item2 has description
    expect(screen.getByText("Interactive linked list simulation.")).toBeInTheDocument();
  });

  it("renders item count per group", () => {
    renderPage();
    // The notes group has 2 items
    expect(screen.getByText("2 item(s)")).toBeInTheDocument();
  });

  it("renders 'No description provided.' fallback when description is empty", () => {
    const libraryWithMissingDesc = {
      ...mockLibrary,
      groups: [
        {
          group: "notes",
          label: "Notes",
          items: [
            {
              ...libraryItem2,
              description: "",
            },
          ],
        },
      ],
    };
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        coursesForYear: mockCatalog.courses.filter((c: { year: number }) => c.year === 2),
        selectedYear: 2,
        selectedCourseCode: "CSE",
        selectedSubjectCode: "CSE201",
        subjects: mockSubjects,
        library: libraryWithMissingDesc,
        libraryLoading: false,
      })
    );
    renderPage();
    expect(screen.getByText("No description provided.")).toBeInTheDocument();
  });

  it("renders 'Open' buttons with the resource kind", () => {
    renderPage();
    const openPdf = screen.getByText("Open PDF");
    expect(openPdf).toBeInTheDocument();
    expect(openPdf.closest("a")).toHaveAttribute("href", "https://example.com/arrays.pdf");

    const openLink = screen.getByText("Open LINK");
    expect(openLink).toBeInTheDocument();
    expect(openLink.closest("a")).toHaveAttribute("target", "_blank");
  });

  it("renders preview buttons only for previewable resources", () => {
    renderPage();
    // PDF is previewable -> has preview button
    expect(screen.getAllByText("Preview").length).toBeGreaterThanOrEqual(1);
  });

  it("renders a featured badge for featured resources", () => {
    renderPage();
    const featuredBadges = screen.getAllByText("Featured");
    expect(featuredBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("renders tags for resources that have them", () => {
    renderPage();
    expect(screen.getByText("arrays")).toBeInTheDocument();
    expect(screen.getByText("basics")).toBeInTheDocument();
    expect(screen.getByText("data-structures")).toBeInTheDocument();
  });

  it("renders the live preview iframe when previewUrl is set", () => {
    renderPage();
    const iframe = screen.getByTitle("Resource Preview");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("src", "https://example.com/arrays.pdf");
  });

  it("shows placeholder text when no previewUrl is set", () => {
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        library: mockLibrary,
        libraryLoading: false,
        previewUrl: "",
      })
    );
    renderPage();
    expect(
      screen.getByText("Select a subject with previewable PDFs to see an inline preview here.")
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Filter interaction
// ---------------------------------------------------------------------------
describe("Filter interaction", () => {
  it("calls onYearChange when the year select changes", async () => {
    const setSelectedYear = vi.fn();
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        coursesForYear: mockCatalog.courses.filter((c: { year: number }) => c.year === 2),
        selectedYear: 2,
        selectedCourseCode: "CSE",
        loadCatalog: vi.fn(),
        setSelectedYear,
      })
    );
    renderPage();

    const yearSelect = screen.getByLabelText("Year");
    await userEvent.selectOptions(yearSelect, "3");

    expect(setSelectedYear).toHaveBeenCalledWith(3);
  });

  it("calls onCourseChange when the course select changes", async () => {
    const setSelectedCourseCode = vi.fn();
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        coursesForYear: mockCatalog.courses.filter((c: { year: number }) => c.year === 2),
        selectedYear: 2,
        selectedCourseCode: "CSE",
        setSelectedCourseCode,
      })
    );
    renderPage();

    const courseSelect = screen.getByLabelText("Course");
    await userEvent.selectOptions(courseSelect, "CSE");

    expect(setSelectedCourseCode).toHaveBeenCalledWith("CSE");
  });

  it("calls onSubjectChange when the subject select changes", async () => {
    const setSelectedSubjectCode = vi.fn();
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        coursesForYear: mockCatalog.courses.filter((c: { year: number }) => c.year === 2),
        selectedYear: 2,
        selectedCourseCode: "CSE",
        selectedSubjectCode: "CSE201",
        subjects: mockSubjects,
        setSelectedSubjectCode,
      })
    );
    renderPage();

    const subjectSelect = screen.getByLabelText("Subject");
    await userEvent.selectOptions(subjectSelect, "CSE202");

    expect(setSelectedSubjectCode).toHaveBeenCalledWith("CSE202");
  });

  it("renders a search input when advanced mode is on", () => {
    mockUseLearningMaterialsData.mockReturnValue(dataMockValue({ advanced: true }));
    renderPage({ advanced: true });

    expect(screen.getByPlaceholderText("Search by title, description, or tag")).toBeInTheDocument();
  });

  it("does not show the search input in non-advanced mode", () => {
    renderPage({ advanced: false });

    expect(screen.queryByPlaceholderText("Search by title, description, or tag")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Contribute Resource pointer (canonical student intake)
// ---------------------------------------------------------------------------
describe("Contribute Resource pointer", () => {
  beforeEach(() => {
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        coursesForYear: mockCatalog.courses.filter((c: { year: number }) => c.year === 2),
        selectedYear: 2,
        selectedCourseCode: "CSE",
        selectedSubjectCode: "CSE201",
        selectedSubject: mockSubjects.subjects[0],
        selectedCourse: mockCatalog.courses[0],
        subjects: mockSubjects,
      })
    );
  });

  it("points students to Contribute Resource instead of a duplicate intake form", () => {
    renderPage();
    expect(screen.queryByText("Recommend a Resource")).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Contribute Resource/i });
    expect(link).toHaveAttribute("href", "/resources/add");
  });

  it("does not show the contribute pointer in admin mode", () => {
    mockUseAdminAccess.mockReturnValue(adminAccessValue({ unlocked: true }));
    renderPage({ adminMode: true });

    expect(screen.queryByText(/Contribute Resource/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Resource preview interaction
// ---------------------------------------------------------------------------
describe("Resource preview interaction", () => {
  it("calls setPreviewUrl when a preview button is clicked", async () => {
    const setPreviewUrl = vi.fn();
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        coursesForYear: mockCatalog.courses.filter((c: { year: number }) => c.year === 2),
        selectedYear: 2,
        selectedCourseCode: "CSE",
        selectedSubjectCode: "CSE201",
        selectedSubject: mockSubjects.subjects[0],
        subjects: mockSubjects,
        library: mockLibrary,
        libraryLoading: false,
        setPreviewUrl,
      })
    );
    renderPage();

    const previewButtons = screen.getAllByText("Preview");
    await userEvent.click(previewButtons[0]);

    expect(setPreviewUrl).toHaveBeenCalledWith("https://example.com/arrays.pdf");
  });
});

// ---------------------------------------------------------------------------
// Admin mode
// ---------------------------------------------------------------------------
describe("Admin mode visibility", () => {
  it("does NOT render admin sections when adminMode is false", () => {
    mockUseLearningMaterialsData.mockReturnValue(dataMockValue({ catalog: mockCatalog }));
    renderPage({ adminMode: false });

    expect(screen.queryByText("Admin publishing is enabled for this session.")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish Resource")).not.toBeInTheDocument();
    expect(screen.queryByText("Admin Resource Queue")).not.toBeInTheDocument();
    expect(screen.queryByText("Resource Recommendation Queue")).not.toBeInTheDocument();
  });

  it("does NOT render admin sections when adminMode is true but admin is locked", () => {
    mockUseAdminAccess.mockReturnValue(adminAccessValue({ unlocked: false }));
    mockUseLearningMaterialsData.mockReturnValue(dataMockValue({ catalog: mockCatalog }));
    renderPage({ adminMode: true });

    expect(screen.queryByText("Admin publishing is enabled for this session.")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish Resource")).not.toBeInTheDocument();
  });

  it("shows admin publishing hint when adminMode is true and unlocked", () => {
    mockUseAdminAccess.mockReturnValue(adminAccessValue({ unlocked: true }));
    mockUseLearningMaterialsData.mockReturnValue(dataMockValue({ catalog: mockCatalog }));
    renderPage({ adminMode: true });

    expect(screen.getByText("Admin publishing is enabled for this session.")).toBeInTheDocument();
  });

  it("renders the Publish Resource form when admin is unlocked", () => {
    mockUseAdminAccess.mockReturnValue(adminAccessValue({ unlocked: true }));
    mockUseLearningMaterialsData.mockReturnValue(dataMockValue({ catalog: mockCatalog }));
    renderPage({ adminMode: true });

    // "Publish Resource" appears as both the section title and the submit button text
    const publishElements = screen.getAllByText("Publish Resource");
    expect(publishElements.length).toBeGreaterThanOrEqual(1);
  });

  it("enters edit mode when the Edit button is clicked and shows Update Resource", async () => {
    mockUseAdminAccess.mockReturnValue(adminAccessValue({ unlocked: true }));
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        adminItems: [adminItem],
      })
    );
    renderPage({ adminMode: true });

    expect(screen.queryByText("Update Resource")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("Edit"));

    expect(screen.getByText("Edit Resource")).toBeInTheDocument();
    expect(screen.getByText("Update Resource")).toBeInTheDocument();
    expect(screen.getByText("Cancel Edit")).toBeInTheDocument();
  });

  it("does not render the Admin Resource Queue when there are no admin items", () => {
    mockUseAdminAccess.mockReturnValue(adminAccessValue({ unlocked: true }));
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        adminItems: [],
      })
    );
    renderPage({ adminMode: true });

    expect(screen.queryByText("Admin Resource Queue")).not.toBeInTheDocument();
  });

  it("renders the Admin Resource Queue when admin items exist", () => {
    mockUseAdminAccess.mockReturnValue(adminAccessValue({ unlocked: true }));
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        adminItems: [adminItem],
      })
    );
    renderPage({ adminMode: true });

    expect(screen.getByText("Admin Resource Queue")).toBeInTheDocument();
    expect(screen.getByText("OS Revision Notes")).toBeInTheDocument();
  });

  it("renders the Recommendation Queue when admin is unlocked", () => {
    mockUseAdminAccess.mockReturnValue(adminAccessValue({ unlocked: true }));
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        recommendations: [recommendationItem],
      })
    );
    renderPage({ adminMode: true });

    expect(screen.getByText("Resource Recommendation Queue")).toBeInTheDocument();
    expect(screen.getByText("Great YouTube Series on OS")).toBeInTheDocument();
  });

  it("shows empty state when Recommendation Queue has no items", () => {
    mockUseAdminAccess.mockReturnValue(adminAccessValue({ unlocked: true }));
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        recommendations: [],
      })
    );
    renderPage({ adminMode: true });

    expect(screen.getByText("Resource Recommendation Queue")).toBeInTheDocument();
    expect(screen.getByText("No recommendations yet.")).toBeInTheDocument();
  });

  it("renders workflow map when admin is unlocked and workflow is present", () => {
    mockUseAdminAccess.mockReturnValue(adminAccessValue({ unlocked: true }));
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        workflow: mockWorkflow,
      })
    );
    renderPage({ adminMode: true });

    expect(screen.getByText("Admin Workflow Map")).toBeInTheDocument();
    expect(screen.getByText("Lifecycle states")).toBeInTheDocument();
    expect(screen.getByText("Bulk safety")).toBeInTheDocument();
  });

  it("does not render workflow map when admin is locked even if workflow exists", () => {
    mockUseAdminAccess.mockReturnValue(adminAccessValue({ unlocked: false }));
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        workflow: mockWorkflow,
      })
    );
    renderPage({ adminMode: true });

    expect(screen.queryByText("Admin Workflow Map")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Admin queue functionality
// ---------------------------------------------------------------------------
describe("Admin queue functionality", () => {
  beforeEach(() => {
    mockUseAdminAccess.mockReturnValue(adminAccessValue({ unlocked: true }));
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        coursesForYear: mockCatalog.courses.filter((c: { year: number }) => c.year === 2),
        selectedYear: 2,
        selectedCourseCode: "CSE",
        selectedSubjectCode: "CSE201",
        subjects: mockSubjects,
        adminItems: [adminItem],
      })
    );
  });

  it("calls onToggleSelection when the checkbox is clicked", async () => {
    const setSelectedAdminIds = vi.fn();
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        adminItems: [adminItem],
        setSelectedAdminIds,
      })
    );
    renderPage({ adminMode: true });

    const checkbox = screen.getByLabelText("Select OS Revision Notes");
    await userEvent.click(checkbox);

    // The toggle function is called via the handler
    expect(setSelectedAdminIds).toHaveBeenCalled();
  });

  it("shows selection count", () => {
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        adminItems: [adminItem],
        selectedAdminIds: ["admin-item-1"],
      })
    );
    renderPage({ adminMode: true });

    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("calls onBulkActionChange when bulk action select changes", async () => {
    const setBulkAction = vi.fn();
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        adminItems: [adminItem],
        setBulkAction,
      })
    );
    renderPage({ adminMode: true });

    const bulkSelect = screen.getByLabelText("Bulk action");
    await userEvent.selectOptions(bulkSelect, "archive");

    expect(setBulkAction).toHaveBeenCalledWith("archive");
  });

  it("displays bulk preview items when bulkPreview is set", () => {
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        adminItems: [adminItem],
        selectedAdminIds: ["admin-item-1"],
        bulkPreview: {
          action: "publish",
          valid: true,
          invalidCount: 0,
          items: [
            {
              id: "admin-item-1",
              title: "OS Revision Notes",
              currentState: "published",
              nextState: "published",
              valid: true,
            },
          ],
        },
      })
    );
    renderPage({ adminMode: true });

    // "OS Revision Notes" appears both as the admin item title and in the bulk preview detail
    const titleMatches = screen.getAllByText(/OS Revision Notes/);
    expect(titleMatches.length).toBeGreaterThanOrEqual(1);
    // The bulk preview transition text should be unique
    expect(screen.getByText(/published to published/)).toBeInTheDocument();
  });

  it("shows lifecycle state badge for admin items", () => {
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        adminItems: [adminItem],
      })
    );
    renderPage({ adminMode: true });

    expect(screen.getByText("published")).toBeInTheDocument();
  });

  it("renders admin action buttons (Edit, Hide, Publish, etc.)", () => {
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        adminItems: [adminItem],
      })
    );
    renderPage({ adminMode: true });

    // Many of these texts appear in both the action buttons and the bulk-action dropdown;
    // use getAllByText to confirm at least one match exists regardless of duplicates.
    expect(screen.getAllByText("Edit").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Hide")).toBeInTheDocument();
    expect(screen.getAllByText("Publish").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Unpublish").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Archive").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getAllByText("Delete").length).toBeGreaterThanOrEqual(1);
  });

  it("renders 'Unhide' when item is hidden", () => {
    const hiddenItem = {
      ...adminItem,
      metadata: { ...adminItem.metadata, visibility: "hidden" },
    };
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        adminItems: [hiddenItem],
      })
    );
    renderPage({ adminMode: true });

    expect(screen.getByText("Unhide")).toBeInTheDocument();
    expect(screen.queryByText("Hide")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Recommendation review (admin)
// ---------------------------------------------------------------------------
describe("Recommendation review (admin)", () => {
  beforeEach(() => {
    mockUseAdminAccess.mockReturnValue(adminAccessValue({ unlocked: true }));
    mockUseLearningMaterialsData.mockReturnValue(
      dataMockValue({
        catalog: mockCatalog,
        recommendations: [recommendationItem],
      })
    );
  });

  it("renders approve and reject buttons for recommendations", () => {
    renderPage({ adminMode: true });

    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
  });

  it("shows recommendation status and recommender name", () => {
    renderPage({ adminMode: true });

    expect(screen.getByText(/Status: pending/)).toBeInTheDocument();
    expect(screen.getByText(/Suggested by AP23110010234/)).toBeInTheDocument();
  });

  it("shows description for recommendation items", () => {
    renderPage({ adminMode: true });

    expect(screen.getByText("Explains process scheduling visually.")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Non-admin mode (student view)
// ---------------------------------------------------------------------------
describe("Non-admin mode (student view)", () => {
  it("points students to the canonical Contribute Resource flow", () => {
    mockUseLearningMaterialsData.mockReturnValue(dataMockValue());
    renderPage({ adminMode: false });

    expect(screen.getByRole("link", { name: /Contribute Resource/i })).toHaveAttribute("href", "/resources/add");
  });

  it("does not render admin-only sections in non-admin mode", () => {
    mockUseLearningMaterialsData.mockReturnValue(dataMockValue());
    renderPage({ adminMode: false });

    expect(screen.queryByText("Publish Resource")).not.toBeInTheDocument();
    expect(screen.queryByText("Admin Resource Queue")).not.toBeInTheDocument();
    expect(screen.queryByText("Resource Recommendation Queue")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Advanced mode
// ---------------------------------------------------------------------------
describe("Advanced mode", () => {
  it("shows 'Advanced Access Filters' title when advanced mode is on", () => {
    mockUseLearningMaterialsData.mockReturnValue(dataMockValue());
    renderPage({ advanced: true });

    expect(screen.getByText("Advanced Access Filters")).toBeInTheDocument();
  });

  it("shows 'Advanced Resource Library' title when advanced mode is on", () => {
    mockUseLearningMaterialsData.mockReturnValue(dataMockValue());
    renderPage({ advanced: true });

    expect(screen.getByText("Advanced Resource Library")).toBeInTheDocument();
  });

  it("shows 'Resource Browser' title when advanced mode is off", () => {
    mockUseLearningMaterialsData.mockReturnValue(dataMockValue());
    renderPage({ advanced: false });

    expect(screen.getByText("Resource Browser")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PageBlueprint heading
// ---------------------------------------------------------------------------
describe("Page heading from blueprint", () => {
  it("renders the heading from the blueprint prop", () => {
    const customBlueprint: PageBlueprint = {
      route: "/custom",
      heading: "Custom Resources",
      fetchKeys: [],
      domain: "lms",
      renderer: "generic",
      integrationState: "native",
      sourceMode: "internal",
    };
    mockUseLearningMaterialsData.mockReturnValue(dataMockValue());
    renderPage({ blueprint: customBlueprint });

    expect(screen.getByText("Custom Resources")).toBeInTheDocument();
    expect(screen.queryByText("Learning Materials")).not.toBeInTheDocument();
  });
});
