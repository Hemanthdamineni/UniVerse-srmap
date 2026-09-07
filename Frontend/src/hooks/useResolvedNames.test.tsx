import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createTestQueryClient } from "../test/testUtils";
import { useResolvedNames } from "./useResolvedNames";
import { resolveUserNames } from "../lib/campus/usersApi";

vi.mock("../lib/campus/usersApi", () => ({ resolveUserNames: vi.fn() }));

const mockResolve = vi.mocked(resolveUserNames);

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>;
}

describe("useResolvedNames", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the raw id until names load, then the resolved name", async () => {
    mockResolve.mockResolvedValue({ AP1: "Asha Rao" });
    const { result } = renderHook(() => useResolvedNames(["AP1", "AP2"]), { wrapper });

    // Before the query resolves, everything falls back to the id.
    expect(result.current("AP1")).toBe("AP1");

    await waitFor(() => expect(result.current("AP1")).toBe("Asha Rao"));
    expect(result.current("AP2")).toBe("AP2"); // unknown → raw id
    expect(result.current("")).toBe("");
    expect(result.current(null)).toBe("");
  });

  it("de-dupes, trims and sorts before requesting, and skips when empty", async () => {
    mockResolve.mockResolvedValue({});
    const { rerender } = renderHook(({ ids }) => useResolvedNames(ids), {
      wrapper,
      initialProps: { ids: [" AP2 ", "AP1", "AP2", ""] as Array<string | null> },
    });
    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith(["AP1", "AP2"]));

    rerender({ ids: [] });
    // No new call for an empty set.
    expect(mockResolve).toHaveBeenCalledTimes(1);
  });
});
