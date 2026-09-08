import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "../../test/testUtils";
import { SavedSearchBar } from "./SavedSearchBar";
import {
  listSavedSearches,
  createSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
} from "../../lib/career/careerApi";

vi.mock("../../lib/career/careerApi", () => ({
  listSavedSearches: vi.fn(),
  createSavedSearch: vi.fn(),
  updateSavedSearch: vi.fn(),
  deleteSavedSearch: vi.fn(),
}));

const saved = (over = {}) => ({
  id: "s1",
  name: "React internships",
  filters: { query: "react", type: "internship" },
  alertsEnabled: false,
  createdAt: "2026-01-01",
  lastRunAt: null,
  ...over,
});

function renderBar(props: Partial<React.ComponentProps<typeof SavedSearchBar>> = {}) {
  const onApply = vi.fn();
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <SavedSearchBar currentFilters={{ query: "rust" }} onApply={onApply} {...props} />
    </QueryClientProvider>,
  );
  return { onApply };
}

describe("SavedSearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listSavedSearches).mockResolvedValue({ items: [saved()] });
    vi.mocked(createSavedSearch).mockResolvedValue(saved({ id: "s2", name: "Rust" }) as never);
    vi.mocked(updateSavedSearch).mockResolvedValue(saved({ alertsEnabled: true }) as never);
    vi.mocked(deleteSavedSearch).mockResolvedValue({ deleted: true });
  });

  it("applies a saved search's filters on click", async () => {
    const user = userEvent.setup();
    const { onApply } = renderBar();
    await user.click(await screen.findByRole("button", { name: "React internships" }));
    expect(onApply).toHaveBeenCalledWith({ query: "react", type: "internship" });
  });

  it("toggles the alert bell for a saved search", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(await screen.findByRole("button", { name: /Alert me about React internships/i }));
    expect(updateSavedSearch).toHaveBeenCalledWith("s1", { alertsEnabled: true });
  });

  it("saves the current filters under a name, with alerts on by default", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(await screen.findByRole("button", { name: /Save search/i }));
    await user.type(screen.getByLabelText("Saved search name"), "Rust roles");
    await user.click(screen.getByRole("button", { name: "Save search" }));
    await waitFor(() =>
      expect(createSavedSearch).toHaveBeenCalledWith({
        name: "Rust roles",
        filters: { query: "rust" },
        alertsEnabled: true,
      }),
    );
  });

  it("disables Save search when no filter is active", async () => {
    renderBar({ currentFilters: {} });
    expect(await screen.findByRole("button", { name: /Save search/i })).toBeDisabled();
  });
});
