import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import IntranetFeedWidget from "./IntranetFeedWidget";

vi.mock("../../lib/intranet/intranetApi", () => ({
  getIntranetFeed: vi.fn(),
}));

import { getIntranetFeed } from "../../lib/intranet/intranetApi";

function renderWidget() {
  return render(
    <MemoryRouter>
      <IntranetFeedWidget limit={5} />
    </MemoryRouter>
  );
}

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

describe("IntranetFeedWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a loading heading while fetching", () => {
    (getIntranetFeed as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderWidget();
    expect(screen.getByText("Intranet Updates")).toBeInTheDocument();
  });

  it("renders fetched intranet items with content-type labels", async () => {
    (getIntranetFeed as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeItem(),
      makeItem({ id: "item-2", contentType: "news", title: "Research Breakthrough" }),
    ]);
    renderWidget();
    await waitFor(() => {
      expect(screen.getByText("Scholarship Applications Open")).toBeInTheDocument();
    });
    expect(screen.getByText("Research Breakthrough")).toBeInTheDocument();
    expect(screen.getAllByText("Announcement").length).toBeGreaterThan(0);
    expect(screen.getByText("News")).toBeInTheDocument();
  });

  it("shows an empty state when the feed is empty", async () => {
    (getIntranetFeed as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderWidget();
    await waitFor(() => {
      expect(screen.getByText("No intranet updates right now.")).toBeInTheDocument();
    });
  });

  it("shows an error state and retries on failure", async () => {
    (getIntranetFeed as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("Network down"))
      .mockResolvedValueOnce([makeItem()]);
    renderWidget();
    await waitFor(() => {
      expect(screen.getByText("Network down")).toBeInTheDocument();
    });
    screen.getByText("Retry").click();
    await waitFor(() => {
      expect(screen.getByText("Scholarship Applications Open")).toBeInTheDocument();
    });
  });
});