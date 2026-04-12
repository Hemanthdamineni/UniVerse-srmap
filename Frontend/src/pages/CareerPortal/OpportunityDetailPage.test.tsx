import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { CareerOpportunity } from "../../lib/careerApi";
import OpportunityDetailPage from "./OpportunityDetailPage";

const getOpportunity = vi.fn();
const trackView = vi.fn(() => Promise.resolve({ tracked: true }));
const bookmarkOpportunity = vi.fn(() => Promise.resolve({ bookmarked: true }));
const trackApply = vi.fn(() => Promise.resolve({ tracked: true }));
const createApplication = vi.fn(() =>
  Promise.resolve({
    id: "a1",
    opportunityId: "o1",
    userId: "u1",
    status: "applied",
    appliedAt: "2026-01-01",
  })
);
const flagOpportunity = vi.fn(() => Promise.resolve({ flagged: true }));

vi.mock("../../lib/careerApi", () => ({
  get getOpportunity() {
    return getOpportunity;
  },
  get trackView() {
    return trackView;
  },
  get bookmarkOpportunity() {
    return bookmarkOpportunity;
  },
  get trackApply() {
    return trackApply;
  },
  get createApplication() {
    return createApplication;
  },
  get flagOpportunity() {
    return flagOpportunity;
  },
}));

vi.mock("../../hooks/useSession", () => ({
  useSession: () => ({
    profile: {
      TableContent: {
        "Program / Section": "B.Tech Computer Science / A",
        "Academic Year": "III Year",
      },
    },
    loading: false,
  }),
}));

function baseOpp(over: Partial<CareerOpportunity> = {}): CareerOpportunity {
  return {
    id: "o1",
    type: "internship",
    title: "Detail Title",
    shortDescription: "Short",
    description: "Full description text.",
    skills: ["Python", "Go"],
    tags: [],
    isPanIndia: true,
    eligibleBranches: [],
    eligibleYears: [],
    isFree: true,
    source: "manual",
    sourceUrl: "https://example.edu/src",
    applyUrl: "https://example.edu/apply",
    viewCount: 0,
    bookmarkCount: 0,
    applyCount: 0,
    relevanceScore: 1,
    isActive: true,
    isVerified: true,
    isFeatured: false,
    deadline: "2026-12-31T00:00:00.000Z",
    mode: "remote",
    skillMatch: { matched: ["Python"], missing: ["Go"], percent: 50 },
    ...over,
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/career/opportunities/:id" element={<OpportunityDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("OpportunityDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOpportunity.mockResolvedValue(baseOpp());
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  it("loads opportunity and supports apply, bookmark, tracker", async () => {
    const user = userEvent.setup();
    renderAt("/career/opportunities/o1");
    await waitFor(() => expect(screen.getByText("Detail Title")).toBeInTheDocument());
    expect(trackView).toHaveBeenCalledWith("o1");
    await user.click(screen.getByRole("button", { name: /Apply Now/i }));
    expect(trackApply).toHaveBeenCalledWith("o1");
    expect(window.open).toHaveBeenCalled();
    const bm = document.querySelector("button svg.lucide-bookmark")?.closest("button");
    await user.click(bm!);
    expect(bookmarkOpportunity).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Add to Tracker/i }));
    expect(createApplication).toHaveBeenCalled();
  });

  it("shows error UI when fetch fails", async () => {
    getOpportunity.mockRejectedValue(new Error("network"));
    renderAt("/career/opportunities/bad");
    await waitFor(() =>
      expect(screen.getByText(/Opportunity not found or an error occurred/i)).toBeInTheDocument()
    );
  });

  it("renders similar opportunities when provided", async () => {
    getOpportunity.mockResolvedValue(
      baseOpp({
        similar: [
          {
            ...baseOpp({ id: "o2", title: "Similar One" }),
          },
        ],
      })
    );
    renderAt("/career/opportunities/o1");
    await waitFor(() => expect(screen.getByText(/Similar opportunities/i)).toBeInTheDocument());
    expect(screen.getByText("Similar One")).toBeInTheDocument();
  });

  it("flag flow calls API when user confirms prompt", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("spam");
    vi.spyOn(window, "alert").mockImplementation(() => {});
    renderAt("/career/opportunities/o1");
    await waitFor(() => expect(screen.getByText("Detail Title")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Flag for moderation/i }));
    await waitFor(() => expect(flagOpportunity).toHaveBeenCalledWith("o1", "spam"));
  });
});
