import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminLmsModerationPage from "./AdminLmsModerationPage";

const adminHeaders = { "x-admin-password": "test-admin" };
const getLmsResourceModerationQueue = vi.fn();
const moderateLmsResource = vi.fn();

vi.mock("../../contexts/AdminModeContext", () => ({
  useAdminMode: () => ({
    isAdmin: true,
    adminHeaders,
  }),
}));

vi.mock("../../lib/lms/index", () => ({
  get getLmsResourceModerationQueue() {
    return getLmsResourceModerationQueue;
  },
  get moderateLmsResource() {
    return moderateLmsResource;
  },
}));

describe("AdminLmsModerationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    getLmsResourceModerationQueue.mockResolvedValue({
      counts: { total: 1, flagged: 1, visible: 1, hidden: 0, removed: 0 },
      pagination: { page: 1, limit: 25, total: 1 },
      items: [
        {
          id: "res-flagged",
          title: "Normalization checklist",
          description: "Needs citations before it should be promoted.",
          type: "note",
          semester: "6",
          subjectCode: "CSE301",
          subjectName: "Database Systems",
          unit: "Normalization",
          unitNormalized: "normalization",
          tags: ["dbms"],
          uploadedBy: "AP23110010555",
          uploadedAt: "2026-05-20T09:30:00.000Z",
          viewCount: 100,
          upvotes: 11,
          bookmarkCount: 8,
          commentCount: 2,
          qualityScore: 5,
          effectivenessScore: 1,
          examProvenScore: 1,
          moderation: {
            state: 1,
            label: "Flagged for review",
            flagCount: 1,
            publicEligible: true,
            searchEligible: true,
            recommendationEligible: false,
            needsReview: true,
          },
          publisher: {
            userId: "AP23110010555",
            displayName: "AP23110010555",
            contributionCount: 3,
            approvedCount: 2,
            flaggedCount: 1,
            hiddenCount: 0,
            qualityAverage: 5.6,
            upvoteTotal: 19,
            trustScore: 64,
          },
          flags: [
            {
              id: "flag-1",
              resourceId: "res-flagged",
              userId: "AP23110010001",
              reason: "Needs citation review",
              status: "open",
              createdAt: "2026-05-25T08:00:00.000Z",
            },
          ],
          audit: [
            {
              id: "audit-1",
              resourceId: "res-flagged",
              action: "reported",
              actorId: "AP23110010001",
              createdAt: "2026-05-25T08:00:00.000Z",
            },
          ],
        },
      ],
    });
    moderateLmsResource.mockResolvedValue({ resource: { id: "res-flagged" }, audit: [] });
  });

  it("renders moderation evidence and enforces reasoned decisions", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminLmsModerationPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Normalization checklist")).toBeInTheDocument();
    expect(screen.getByText("Latest report: Needs citation review by AP23110010001")).toBeInTheDocument();
    expect(screen.getByText("Trust 64")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Moderation reason is required before changing visibility.")).toBeInTheDocument();
    expect(moderateLmsResource).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Decision reason for res-flagged"), "Citations verified by admin.");
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(moderateLmsResource).toHaveBeenCalled());
    expect(moderateLmsResource).toHaveBeenCalledWith(
      "res-flagged",
      { decision: "approve", reason: "Citations verified by admin." },
      adminHeaders
    );
  });
});
