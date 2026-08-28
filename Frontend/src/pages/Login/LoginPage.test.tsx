import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import LoginPage from "./LoginPage";
import { createTestQueryClient } from "../../test/testUtils";

vi.mock("axios");

const CAPTCHA_PAYLOAD = {
  data: {
    captchaBase64: "data:image/png;base64,iVBORw0KGgo=",
    sessionId: "captcha-session-1",
    expiresInMs: 60_000,
  },
};

function renderLogin() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(axios.get).mockResolvedValue(CAPTCHA_PAYLOAD);
  });

  it("renders the sign-in form and loads a captcha image", async () => {
    renderLogin();

    expect(screen.getByLabelText("Registration Number")).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Captcha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refresh captcha/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByAltText("Captcha challenge")).toBeInTheDocument();
    });
    expect(vi.mocked(axios.get)).toHaveBeenCalledWith("/api/captcha", expect.anything());
  });

  it("shows the expiry countdown and meter once a captcha is loaded", async () => {
    const { container } = renderLogin();

    const countdown = await screen.findByTitle("Time before this captcha expires");
    expect(countdown.textContent).toMatch(/^\d+s$/);

    // The expiry meter lives below the captcha box, not inside it.
    const meter = container.querySelector('div[aria-hidden="true"]');
    expect(meter).not.toBeNull();
    expect(meter?.firstElementChild).not.toBeNull();
    expect(meter?.firstElementChild?.getAttribute("style")).toMatch(/width:\s*\d+(\.\d+)?%/);
  });

  it("keeps the countdown and meter hidden while the captcha is loading", () => {
    vi.mocked(axios.get).mockReturnValue(new Promise(() => {}));
    renderLogin();

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByTitle("Time before this captcha expires")).not.toBeInTheDocument();
  });
});
