import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import EventsRegistrationHub from "./EventsRegistrationHub";

describe("EventsRegistrationHub", () => {
  beforeEach(() => {
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("routes registration-module users into native event registration and submission paths", () => {
    render(
      <MemoryRouter>
        <EventsRegistrationHub />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Events Registration" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open events" })).toHaveAttribute("href", "/events");
    expect(screen.getByRole("link", { name: "View registrations" })).toHaveAttribute(
      "href",
      "/events/my-activity?tab=registered"
    );
    expect(screen.getByRole("link", { name: "View submissions" })).toHaveAttribute(
      "href",
      "/events/my-activity?tab=submissions"
    );
    expect(screen.getByText(/Legacy ERP event-registration data is reference-only/i)).toBeInTheDocument();
  });
});
