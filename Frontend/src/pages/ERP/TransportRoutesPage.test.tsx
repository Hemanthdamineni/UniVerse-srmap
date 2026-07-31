import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import TransportRoutesPage from "./TransportRoutesPage";
import { getErpBatch } from "../../lib/erp/index";

vi.mock("../../lib/erp/index", () => ({
  getErpBatch: vi.fn(),
  executeErpAction: vi.fn(),
}));

describe("TransportRoutesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (getErpBatch as any).mockResolvedValue({
      "transport/transport-&-faqs": {
        success: true,
        data: {
          testSection: {
            testSubitem: {
              _extracted: {
                type: "transport-routes",
                title: "Transport Routes",
                records: [
                  {
                    routeId: "1",
                    routeName: "Route A",
                    stops: "Stop 1, Stop 2",
                    busNumber: "Bus 12",
                    timings: "9:00 AM",
                    driverName: "John Doe",
                    driverContact: "1234567890",
                  }
                ]
              }
            }
          }
        }
      }
    });
  });

  it("renders page title and transport routes table", async () => {
    render(
      <MemoryRouter>
        <TransportRoutesPage blueprint={{
          route: "/transport-hostel/routes",
          heading: "Transport Routes",
          fetchKeys: ["transport/transport-&-faqs"],
          renderer: "generic" as any,
          domain: "campus",
        }} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Route A").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Bus 12").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Stop 1, Stop 2").length).toBeGreaterThan(0);
      expect(screen.getAllByText("John Doe").length).toBeGreaterThan(0);
    });
  });
});
