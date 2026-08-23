import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { createTestQueryClient } from "../../test/testUtils";
import { useBlueprintPageData } from "./useBlueprintPageData";

vi.mock("./blueprintData/api", () => ({
  loadErpKey: vi.fn(),
  loadExternalPage: vi.fn(),
}));

import { loadErpKey } from "./blueprintData/api";

const mockedLoadErpKey = vi.mocked(loadErpKey);

function makeErpBlueprint(fetchKeys: string[]): PageBlueprint {
  return {
    route: "/test-erp",
    heading: "Test ERP",
    fetchKeys,
    domain: "erp",
    renderer: "generic",
    integrationState: "adapter",
    sourceMode: "erp",
  };
}

const placeholderBlueprint: PageBlueprint = {
  route: "/test-placeholder",
  heading: "Test Placeholder",
  fetchKeys: [],
  domain: "erp",
  renderer: "generic",
  integrationState: "placeholder",
  placeholderReason: "Not wired up yet",
};

function renderHookWithClient(blueprint: PageBlueprint, reloadToken?: number) {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(({ token }: { token: number }) => useBlueprintPageData(blueprint, token), {
    initialProps: { token: reloadToken ?? 0 },
    wrapper,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useBlueprintPageData", () => {
  it("loads every ERP key and settles into a normalized, non-loading state", async () => {
    mockedLoadErpKey.mockResolvedValue({
      pageKey: "academic/time-table",
      source: "live",
      payload: {},
      updatedAt: "2026-08-23T00:00:00.000Z",
    });

    const { result } = renderHookWithClient(makeErpBlueprint(["academic/time-table"]));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockedLoadErpKey).toHaveBeenCalledWith("academic/time-table");
    expect(result.current.error).toBeNull();
    expect(Array.isArray(result.current.sections)).toBe(true);
  });

  it("surfaces the failing key's message as the page error", async () => {
    mockedLoadErpKey.mockImplementation(async (pageKey: string) => {
      if (pageKey === "bad/key") throw new Error("Scrape failed");
      return { pageKey, source: "live", payload: {} };
    });

    const { result } = renderHookWithClient(makeErpBlueprint(["good/key", "bad/key"]));

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error).toContain("Scrape failed");
    expect(result.current.isLoading).toBe(false);
  });

  it("renders placeholder state without touching the network", async () => {
    const { result } = renderHookWithClient(placeholderBlueprint);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockedLoadErpKey).not.toHaveBeenCalled();
    expect(result.current.source).toBe("Placeholder");
    expect(result.current.statuses[0]?.text).toBe("Not wired up yet");
  });

  it("refetches when the reload token changes", async () => {
    mockedLoadErpKey.mockResolvedValue({
      pageKey: "academic/time-table",
      source: "live",
      payload: {},
    });

    const { result, rerender } = renderHookWithClient(makeErpBlueprint(["academic/time-table"]));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(mockedLoadErpKey).toHaveBeenCalledTimes(1);

    rerender({ token: 1 });

    await waitFor(() => {
      expect(mockedLoadErpKey).toHaveBeenCalledTimes(2);
    });
  });
});
