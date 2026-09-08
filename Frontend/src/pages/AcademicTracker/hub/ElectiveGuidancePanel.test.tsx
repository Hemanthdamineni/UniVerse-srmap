import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "../../../test/testUtils";
import { ElectiveGuidancePanel } from "./ElectiveGuidancePanel";
import { getElectiveGuidance } from "../../../lib/career/careerApi";

vi.mock("../../../lib/career/careerApi", () => ({ getElectiveGuidance: vi.fn() }));

function renderPanel() {
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>
        <ElectiveGuidancePanel />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ElectiveGuidancePanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ranks electives for the resolved career track", async () => {
    vi.mocked(getElectiveGuidance).mockResolvedValue({
      tracks: [{ id: "ml-ai", label: "ML / AI Engineer", primary: true }],
      electives: [
        {
          code: "E1",
          name: "Introduction to Machine Learning",
          credit: 3,
          score: 3,
          tracks: [{ id: "ml-ai", label: "ML / AI Engineer", weight: 3 }],
          why: "Strong for ML / AI Engineer",
        },
      ],
    });
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("Introduction to Machine Learning")).toBeInTheDocument(),
    );
    expect(screen.getByText(/Ranked for/)).toHaveTextContent("ML / AI Engineer");
    expect(screen.getByText("Strong for ML / AI Engineer")).toBeInTheDocument();
    expect(screen.getByText("3 cr")).toBeInTheDocument();
  });

  it("prompts for a career goal when no track resolves", async () => {
    vi.mocked(getElectiveGuidance).mockResolvedValue({ tracks: [], electives: [] });
    renderPanel();
    await waitFor(() => expect(screen.getByText(/Set a target role/)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /career profile/i })).toHaveAttribute(
      "href",
      "/career/me/profile",
    );
  });

  it("explains when a goal resolves but no elective maps to it yet", async () => {
    vi.mocked(getElectiveGuidance).mockResolvedValue({
      tracks: [{ id: "product", label: "Product Management", primary: true }],
      electives: [],
    });
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText(/None of your plan electives map to that track yet/)).toBeInTheDocument(),
    );
  });
});
