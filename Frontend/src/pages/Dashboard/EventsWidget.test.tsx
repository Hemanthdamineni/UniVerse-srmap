import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EventsWidget from "./EventsWidget";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderWidget() {
  return render(
    <MemoryRouter>
      <EventsWidget />
    </MemoryRouter>,
  );
}

describe("EventsWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the upcoming events header", () => {
    renderWidget();
    expect(screen.getByText("Upcoming Events")).toBeInTheDocument();
  });

  it("shows the '3 New' badge", () => {
    renderWidget();
    expect(screen.getByText("3 New")).toBeInTheDocument();
  });

  it("renders the description text", () => {
    renderWidget();
    expect(
      screen.getByText(/Discover hackathons, guest lectures/),
    ).toBeInTheDocument();
  });

  it("renders the CodeSprint 2026 event card", () => {
    renderWidget();
    expect(screen.getByText("CodeSprint 2026")).toBeInTheDocument();
  });

  it("renders the 'Explore Events' button", () => {
    renderWidget();
    expect(
      screen.getByRole("button", { name: /explore events/i }),
    ).toBeInTheDocument();
  });

  it("navigates to /events when Explore Events is clicked", () => {
    renderWidget();
    fireEvent.click(screen.getByRole("button", { name: /explore events/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/events");
  });

  it("navigates to /events when the event card is clicked", () => {
    renderWidget();
    fireEvent.click(screen.getByText("CodeSprint 2026"));
    expect(mockNavigate).toHaveBeenCalledWith("/events");
  });
});
