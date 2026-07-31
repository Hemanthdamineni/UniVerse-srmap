import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import HostelBookingPage from "./HostelBookingPage";
import { getErpBatch } from "../../lib/erp/index";

vi.mock("../../lib/erp/index", () => ({
  getErpBatch: vi.fn(),
  executeErpAction: vi.fn(),
}));

describe("HostelBookingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders mock hostel info when ERP data is missing", async () => {
    (getErpBatch as any).mockResolvedValue({});

    render(
      <MemoryRouter>
        <HostelBookingPage blueprint={{
          route: "/transport-hostel/hostel-booking",
          heading: "Hostel Booking",
          fetchKeys: ["hostel/hostel-booking-for-full-year"],
          renderer: "generic" as any,
          domain: "campus",
        }} />
      </MemoryRouter>
    );

    // Verify mock fallback
    await waitFor(() => {
      expect(screen.getByText("Block A")).toBeInTheDocument();
      expect(screen.getByText("Block B")).toBeInTheDocument();
      expect(screen.getByText("Triple Sharing")).toBeInTheDocument();
      expect(screen.getByText("₹12,000/mo")).toBeInTheDocument();
    });

    // Check KPIs
    expect(screen.getByText("Blocks")).toBeInTheDocument();
    expect(screen.getByText("Occupancy")).toBeInTheDocument();

    // Check maintenance table
    expect(screen.getByText("Maintenance Requests")).toBeInTheDocument();
    expect(screen.getByText("A-101")).toBeInTheDocument();
  });

  it("renders ERP data when available", async () => {
    (getErpBatch as any).mockResolvedValue({
      "hostel/hostel-booking-for-full-year": {
        success: true,
        data: {
          hostels: [
            {
              id: "x",
              blockName: "Super Block",
              roomType: "Single",
              capacity: 1,
              occupants: 0,
              floorPlan: "Ground",
              facilities: ["AC"],
              rent: "₹20,000/mo",
              status: "available",
            }
          ]
        }
      }
    });

    render(
      <MemoryRouter>
        <HostelBookingPage blueprint={{
          route: "/transport-hostel/hostel-booking",
          heading: "Hostel Booking",
          fetchKeys: ["hostel/hostel-booking-for-full-year"],
          renderer: "generic" as any,
          domain: "campus",
        }} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Super Block")).toBeInTheDocument();
      expect(screen.getByText("₹20,000/mo")).toBeInTheDocument();
    });
  });
});
