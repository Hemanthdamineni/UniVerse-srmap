import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import OnboardingFlow from "./OnboardingFlow";
import { createTestQueryClient } from "../../test/testUtils";
import * as intentApi from "../../lib/core/studentIntent";
import * as graphApi from "../../lib/core/studentGraph";
import * as session from "../../lib/core/session";
import * as prototype from "../../lib/core/prototype";

vi.mock("../../lib/core/studentIntent");
vi.mock("../../lib/core/studentGraph");

function renderFlow() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <OnboardingFlow />
    </QueryClientProvider>,
  );
}

const GRAPH_STUB = { skills: [{ skill: "Python", source: "resume", confidence: 0.9 }] };

describe("OnboardingFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(session, "hasSessionAuth").mockReturnValue(true);
    vi.spyOn(prototype, "isStaticPrototype").mockReturnValue(false);
    (graphApi.getStudentGraph as any).mockResolvedValue(GRAPH_STUB);
    (intentApi.putIntent as any).mockResolvedValue({ status: "complete" });
  });

  it("renders nothing when onboarding is already complete", async () => {
    (intentApi.getIntent as any).mockResolvedValue({ status: "complete" });
    const { container } = renderFlow();
    await waitFor(() => expect(intentApi.getIntent).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("opens the dialog on first run and can be skipped", async () => {
    (intentApi.getIntent as any).mockResolvedValue({ status: "none" });
    renderFlow();

    expect(await screen.findByText("What the app may infer about you")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Skip for now"));
    await waitFor(() => expect(intentApi.putIntent).toHaveBeenCalledWith({ skipped: true }));
  });

  it("walks all five steps and finishes with a complete payload", async () => {
    (intentApi.getIntent as any).mockResolvedValue({ status: "none" });
    renderFlow();

    await screen.findByText("What the app may infer about you");
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole("button", { name: /Next/ }));
    }
    await userEvent.click(screen.getByRole("button", { name: /Finish/ }));

    await waitFor(() => expect(intentApi.putIntent).toHaveBeenCalled());
    const payload = (intentApi.putIntent as any).mock.calls.at(-1)[0];
    expect(payload.status).toBe("complete");
    expect(payload.consent).toEqual({ derivedSignals: false, leaderboards: false, publicProfile: false });
    // skills step was seeded from the graph
    expect(payload.skills).toContain("Python");
  });

  it("shows a re-prompt banner (not the dialog) when the student skipped earlier", async () => {
    (intentApi.getIntent as any).mockResolvedValue({ status: "skipped" });
    renderFlow();

    expect(await screen.findByText(/Tell us your goals/)).toBeInTheDocument();
    expect(screen.queryByText("What the app may infer about you")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("Set it up"));
    expect(await screen.findByText("What the app may infer about you")).toBeInTheDocument();
  });
});
