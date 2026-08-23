import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageBlueprint } from "../../config/erpBlueprints";
import VacantRoomsPage from "./VacantRoomsPage";

const getVacantRooms = vi.fn();

vi.mock("../../lib/erp/vacantRoomsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/erp/vacantRoomsApi")>();
  return {
    ...actual,
    get getVacantRooms() {
      return getVacantRooms;
    },
  };
});

function renderPage() {
  const blueprint: PageBlueprint = {
    route: "/campus/vacant-rooms",
    heading: "Vacant Rooms",
    fetchKeys: [],
    domain: "erp",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "vacant-rooms",
    loadingMessage: "Finding vacant rooms...",
  };
  return render(
    <MemoryRouter>
      <VacantRoomsPage blueprint={blueprint} />
    </MemoryRouter>
  );
}

describe("VacantRoomsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getVacantRooms.mockResolvedValue({
      ok: true,
      day: "monday",
      slotIndex: 0,
      timeWindow: "09:00–09:50",
      vacant: ["AB-301", "C205"],
      occupiedCount: 3,
      knownRooms: 5,
    });
  });

  it("renders heading and day/slot selectors with a result list", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Vacant Rooms" })).toBeInTheDocument();
    expect(await screen.findByText("AB-301")).toBeInTheDocument();
    expect(screen.getByText("C205")).toBeInTheDocument();
    expect(screen.getByText(/2 vacant of 5 known rooms/)).toBeInTheDocument();
  });

  it("refetches when the day selector changes", async () => {
    renderPage();
    await screen.findByText("AB-301");
    expect(getVacantRooms).toHaveBeenCalledTimes(1);

    await userEvent.selectOptions(screen.getByLabelText("Day"), "Friday");

    await waitFor(() => {
      expect(getVacantRooms).toHaveBeenCalledTimes(2);
    });
    expect(getVacantRooms).toHaveBeenLastCalledWith("Friday", expect.any(Number));
  });

  it("shows an empty state when no vacancy data exists", async () => {
    getVacantRooms.mockResolvedValue({
      ok: true,
      day: "friday",
      slotIndex: 7,
      timeWindow: "16:00–17:30",
      vacant: [],
      occupiedCount: 0,
      knownRooms: 0,
    });
    renderPage();
    expect(
      await screen.findByText(/No vacancy data yet/i)
    ).toBeInTheDocument();
  });

  it("surfaces an error with retry", async () => {
    getVacantRooms.mockRejectedValue(new Error("vacant service down"));
    renderPage();
    expect(await screen.findByText("vacant service down")).toBeInTheDocument();

    getVacantRooms.mockResolvedValue({
      ok: true,
      day: "monday",
      slotIndex: 0,
      timeWindow: "09:00–09:50",
      vacant: ["C205"],
      occupiedCount: 1,
      knownRooms: 2,
    });
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("C205")).toBeInTheDocument();
  });
});
