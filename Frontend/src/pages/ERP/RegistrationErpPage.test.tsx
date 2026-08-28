import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test/testUtils";
import RegistrationErpPage from "./RegistrationErpPage";
import { getErpBatch } from "../../lib/erp/index";
import type { PageBlueprint } from "../../config/erpBlueprints";

// Polyfill ResizeObserver for jsdom (used by usePageContrast inside ErpPageShell)
if (typeof ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, "ResizeObserver", {
    value: ResizeObserverStub,
    writable: true,
    configurable: true,
  });
}

vi.mock("../../lib/erp/index", () => ({
  getErpBatch: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
      public code: string,
      public retryable: boolean,
    ) {
      super(message);
    }
  },
}));

// Mirrors the live extractor payloads for /registration/transport-registration:
// a notice wrapped in a header-less table (array rows → numeric "0" keys after
// the legacy adapter) plus an acknowledgment carrying the negative status.
function transportBatchPayload() {
  return {
    "transport/transport-registration": {
      success: true,
      pageKey: "transport/transport-registration",
      data: {
        Transport: {
          "Transport Registration": {
            title: "Transport Registration",
            text: "Note: Students will be allowed to register for one facility only. Please note that the Transport booking will be open soon",
            tables: [[["Please note that the Transport booking will be open soon"]]],
            meta: null,
          },
          "Registration Acknowledgment": {
            title: "You are not registered to Transport",
            text: "Institute: School of Engineering and Sciences | Address: Neerukonda, Mangalagiri | Transport Registration: You are not registered to Transport",
            tables: [
              [
                {
                  Institute: "School of Engineering and Sciences",
                  Address: "Neerukonda, Mangalagiri",
                  "Transport Registration": "You are not registered to Transport",
                },
              ],
            ],
            meta: null,
          },
        },
      },
    },
    "transport/registration-acknowledgment": {
      success: true,
      pageKey: "transport/registration-acknowledgment",
      data: {
        Transport: {
          "Registration Acknowledgment": {
            title: "You are not registered to Transport",
            text: "Transport Registration: You are not registered to Transport",
            tables: [],
            meta: null,
          },
        },
      },
    },
  };
}

const blueprint: PageBlueprint = {
  route: "/registration/transport-registration",
  heading: "Transport Registration",
  fetchKeys: ["transport/transport-registration", "transport/registration-acknowledgment"],
  renderer: "document" as PageBlueprint["renderer"],
  domain: "campus",
  sourceMode: "erp" as never,
  integrationState: "native",
};

function renderPage() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>
        <RegistrationErpPage blueprint={blueprint} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RegistrationErpPage (transport registration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getErpBatch as ReturnType<typeof vi.fn>).mockResolvedValue(transportBatchPayload());
  });

  it("shows Not Registered even when the page also mentions registration positively", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Not Registered")).toBeTruthy();
    });
    expect(screen.queryByText("Registered")).toBeNull();
  });

  it("never renders numeric array-index keys as column headers", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Institute")).toBeTruthy();
    });
    // The "0" header came from array rows leaking through as objects.
    expect(screen.queryByText("0")).toBeNull();
  });

  it("renders the booking notice as text, not as a one-column table", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getAllByText(/Please note that the Transport booking will be open soon/i).length,
      ).toBeGreaterThan(0);
    });
    // The echo shape (header === cell value) must not produce a repeated table.
    expect(screen.queryByText("Please note that the Transport booking will be open soon")).toBeNull();
  });

  it("renders the acknowledgment fields table", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("School of Engineering and Sciences")).toBeTruthy();
    });
    expect(screen.getByText("Neerukonda, Mangalagiri")).toBeTruthy();
  });
});
