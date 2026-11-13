import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import IntranetPage from "./IntranetPage";
import { createTestQueryClient } from "../../test/testUtils";

vi.mock("../../lib/intranet/intranetApi", () => ({
  getIntranetFeed: vi.fn(),
  getIntranetItem: vi.fn(),
}));

import { getIntranetFeed, getIntranetItem } from "../../lib/intranet/intranetApi";

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    sourceKey: "announcements",
    contentType: "announcement",
    audience: "shared",
    title: "Scholarship Applications Open",
    summary: "Apply now",
    publishedAt: "2026-11-05T00:00:00Z",
    sourceUrl: "https://intranet.srmap.edu.in/a/1",
    ...overrides,
  };
}

function renderAt(path: string) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/intranet" element={<IntranetPage />} />
          <Route path="/intranet/:id" element={<IntranetPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("IntranetPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists intranet feed items", async () => {
    (getIntranetFeed as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeItem(),
      makeItem({ id: "item-2", contentType: "news", title: "Research Breakthrough" }),
    ]);
    renderAt("/intranet");
    await waitFor(() => {
      expect(screen.getByText("Scholarship Applications Open")).toBeInTheDocument();
    });
    expect(screen.getByText("Research Breakthrough")).toBeInTheDocument();
    expect(screen.getByText("Intranet Updates")).toBeInTheDocument();
  });

  it("shows empty state when there is no content", async () => {
    (getIntranetFeed as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderAt("/intranet");
    await waitFor(() => {
      expect(screen.getByText("No intranet updates right now.")).toBeInTheDocument();
    });
  });

  it("renders a single item detail from the id route", async () => {
    (getIntranetItem as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeItem({ body: "Full application body", documentLinks: [{ url: "https://x/f.pdf", label: "form" }] })
    );
    renderAt("/intranet/item-1");
    await waitFor(() => {
      expect(screen.getByText("Scholarship Applications Open")).toBeInTheDocument();
    });
    expect(screen.getByText("Full application body")).toBeInTheDocument();
    expect(screen.getByText("form")).toBeInTheDocument();
    expect(screen.getByText(/View original on the SRMAP intranet/i)).toBeInTheDocument();
  });
});