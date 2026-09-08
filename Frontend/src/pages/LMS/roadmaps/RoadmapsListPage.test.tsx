import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "../../../test/testUtils";
import { RoadmapsListPage } from "./RoadmapsListPage";
import { listRoadmaps } from "../../../lib/lms/index";

vi.mock("../../../lib/lms/index", async (importActual) => {
  const actual = await importActual<Record<string, unknown>>();
  return { ...actual, listRoadmaps: vi.fn() };
});

const ROADMAPS = [
  { id: "r1", skill: "Kubernetes", title: "K8s from scratch", description: "clusters, pods" },
  { id: "r2", skill: "React", title: "Modern React", description: "hooks and suspense" },
];

function renderAt(path: string) {
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <RoadmapsListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RoadmapsListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listRoadmaps).mockResolvedValue(ROADMAPS as never);
  });

  it("lists every roadmap without a query", async () => {
    renderAt("/learn/roadmaps");
    await waitFor(() => expect(screen.getByText("K8s from scratch")).toBeInTheDocument());
    expect(screen.getByText("Modern React")).toBeInTheDocument();
  });

  it("filters roadmaps by ?q= (T4.3.1)", async () => {
    renderAt("/learn/roadmaps?q=kubernetes");
    await waitFor(() => expect(screen.getByText("K8s from scratch")).toBeInTheDocument());
    expect(screen.queryByText("Modern React")).not.toBeInTheDocument();
  });

  it("shows a query-specific empty state when nothing matches", async () => {
    renderAt("/learn/roadmaps?q=cobol");
    await waitFor(() => expect(screen.getByText(/No roadmaps for "cobol" yet/i)).toBeInTheDocument());
  });
});
