import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FirstRunGuide from "./FirstRunGuide";

const SEEN_KEY = "erp.onboarding.seenVersion";

describe("FirstRunGuide", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders orientation content on first run", () => {
    render(<FirstRunGuide />);

    expect(screen.getByRole("region", { name: "Getting started" })).toBeInTheDocument();
    expect(screen.getByText("Synced with your SRM account")).toBeInTheDocument();
    expect(screen.getByText(/jumps to any page/)).toBeInTheDocument();
    expect(screen.getByText("Got it")).toBeInTheDocument();
    expect(window.localStorage.getItem(SEEN_KEY)).toBeNull();
  });

  it("stays hidden once onboarding was already seen", () => {
    window.localStorage.setItem(SEEN_KEY, "1");

    const { container } = render(<FirstRunGuide />);

    expect(container).toBeEmptyDOMElement();
  });

  it("marks onboarding seen and reports dismissal", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(<FirstRunGuide onDismiss={onDismiss} />);
    await user.click(screen.getByText("Got it"));

    expect(window.localStorage.getItem(SEEN_KEY)).toBe("1");
    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "Getting started" })).not.toBeInTheDocument();
    });
  });

  it("shows the platform-appropriate shortcut hint", () => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (X11; Linux x86_64)",
      configurable: true,
    });

    const { unmount } = render(<FirstRunGuide />);
    expect(screen.getByText("Ctrl K")).toBeInTheDocument();
    unmount();

    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      configurable: true,
    });
    render(<FirstRunGuide />);
    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });
});
