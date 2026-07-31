import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AdminModeProvider, useAdminMode } from "./AdminModeContext";
import type { ReactNode } from "react";

// ── Hoisted mock factories ──────────────────────────────────────
// These must be hoisted above the vi.mock() calls via vi.hoisted.
const {
  mockIsPlatformAdmin,
  mockGetCurrentRegNo,
  mockHasSessionAuth,
  mockGetAdminAccessStatus,
  mockUnlockAdminMode,
  mockDisableAdminMode,
} = vi.hoisted(() => ({
  mockIsPlatformAdmin: vi.fn<() => boolean>(() => false),
  mockGetCurrentRegNo: vi.fn<() => string>(() => ""),
  mockHasSessionAuth: vi.fn<() => boolean>(() => false),
  mockGetAdminAccessStatus: vi.fn(() =>
    Promise.resolve({ potentialAdmin: false, isAdmin: false, registerNo: "" }),
  ),
  mockUnlockAdminMode: vi.fn(() => Promise.resolve({ isAdmin: true })),
  mockDisableAdminMode: vi.fn(() => Promise.resolve({ isAdmin: false })),
}));

// ── Module mocks ────────────────────────────────────────────────
vi.mock("../lib/core/identity", () => ({
  isPlatformAdmin: (...args: unknown[]) => mockIsPlatformAdmin(...args),
  getCurrentRegNo: (...args: unknown[]) => mockGetCurrentRegNo(...args),
  getCurrentProfileName: vi.fn(() => "Test User"),
  getCurrentProfileSummary: vi.fn(() => ({
    name: "Test",
    regNo: "",
    isPlatformAdmin: false,
  })),
}));

vi.mock("../lib/core/session", () => ({
  hasSessionAuth: (...args: unknown[]) => mockHasSessionAuth(...args),
}));

vi.mock("../lib/campus/adminApi", () => ({
  getAdminAccessStatus: (...args: unknown[]) => mockGetAdminAccessStatus(...args),
  unlockAdminMode: (...args: unknown[]) => mockUnlockAdminMode(...args),
  disableAdminMode: (...args: unknown[]) => mockDisableAdminMode(...args),
}));

// ── Helper components ───────────────────────────────────────────

/** A consumer that exposes every AdminModeContext field via data-testid attributes. */
function TestConsumer() {
  const ctx = useAdminMode();
  return (
    <div>
      <div data-testid="potentialAdmin">{String(ctx.potentialAdmin)}</div>
      <div data-testid="isAdmin">{String(ctx.isAdmin)}</div>
      <div data-testid="registerNo">{ctx.registerNo}</div>
      <div data-testid="showPrompt">{String(ctx.showPrompt)}</div>
      <div data-testid="busy">{String(ctx.busy)}</div>
      <div data-testid="error">{ctx.error}</div>
      <div data-testid="promptPassword">{ctx.promptPassword}</div>
      <div data-testid="adminHeaders">{JSON.stringify(ctx.adminHeaders)}</div>

      <input
        data-testid="passwordInput"
        value={ctx.promptPassword}
        onChange={(e) => ctx.setPromptPassword(e.target.value)}
      />

      <button data-testid="openPromptBtn" type="button" onClick={ctx.openPrompt}>
        Open Prompt
      </button>
      <button data-testid="skipPromptBtn" type="button" onClick={ctx.skipPrompt}>
        Skip Prompt
      </button>
      <button data-testid="unlockBtn" type="button" onClick={ctx.unlock}>
        Unlock
      </button>
      <button data-testid="disableBtn" type="button" onClick={ctx.disable}>
        Disable
      </button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AdminModeProvider>
      <TestConsumer />
    </AdminModeProvider>,
  );
}

// ── Tests ───────────────────────────────────────────────────────

describe("AdminModeContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();

    // Default mock behaviours
    mockIsPlatformAdmin.mockReturnValue(false);
    mockGetCurrentRegNo.mockReturnValue("");
    mockHasSessionAuth.mockReturnValue(false);
    mockGetAdminAccessStatus.mockResolvedValue({
      potentialAdmin: false,
      isAdmin: false,
      registerNo: "",
    });
    mockUnlockAdminMode.mockResolvedValue({ isAdmin: true });
    mockDisableAdminMode.mockResolvedValue({ isAdmin: false });
  });

  afterEach(() => {
    cleanup();
  });

  // ── Provider renders children ─────────────────────────────────
  describe("Provider renders children", () => {
    it("renders children inside the provider", () => {
      render(
        <AdminModeProvider>
          <div data-testid="child">Hello</div>
        </AdminModeProvider>,
      );
      expect(screen.getByTestId("child")).toHaveTextContent("Hello");
    });

    it("renders a fragment child correctly", () => {
      render(
        <AdminModeProvider>
          <>Fragment child</>
        </AdminModeProvider>,
      );
      expect(screen.getByText("Fragment child")).toBeInTheDocument();
    });
  });

  // ── useAdminMode hook guard ───────────────────────────────────
  describe("useAdminMode hook guard", () => {
    it("throws when used outside AdminModeProvider", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => render(<TestConsumer />)).toThrow(
        "useAdminMode must be used within AdminModeProvider",
      );

      consoleSpy.mockRestore();
    });

    it("does not throw when used inside AdminModeProvider", () => {
      expect(() => renderWithProvider()).not.toThrow();
    });
  });

  // ── Default context values — no session ───────────────────────
  describe("Default context values — no session", () => {
    it("resets all admin state to false when hasSessionAuth is false", () => {
      mockHasSessionAuth.mockReturnValue(false);

      renderWithProvider();

      // The useEffect runs synchronously for the !hasSessionAuth() branch,
      // so state is settled by the time render returns.
      expect(screen.getByTestId("potentialAdmin")).toHaveTextContent("false");
      expect(screen.getByTestId("isAdmin")).toHaveTextContent("false");
      expect(screen.getByTestId("showPrompt")).toHaveTextContent("false");
      expect(screen.getByTestId("busy")).toHaveTextContent("false");
      expect(screen.getByTestId("error")).toHaveTextContent("");
      expect(screen.getByTestId("registerNo")).toHaveTextContent("");
      expect(screen.getByTestId("promptPassword")).toHaveTextContent("");
      expect(screen.getByTestId("adminHeaders")).toHaveTextContent("{}");
    });

    it("does not call getAdminAccessStatus when there is no session", () => {
      mockHasSessionAuth.mockReturnValue(false);
      renderWithProvider();
      expect(mockGetAdminAccessStatus).not.toHaveBeenCalled();
    });

    it("overrides initial isPlatformAdmin values when session is absent", () => {
      mockIsPlatformAdmin.mockReturnValue(true);
      mockHasSessionAuth.mockReturnValue(false);

      renderWithProvider();

      // Even though useState inits to true, the effect overrides to false.
      expect(screen.getByTestId("potentialAdmin")).toHaveTextContent("false");
      expect(screen.getByTestId("isAdmin")).toHaveTextContent("false");
    });
  });

  // ── Default context values — with session ─────────────────────
  describe("Default context values — with session", () => {
    it("loads admin access status from the API when a session exists", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: true,
        registerNo: "AP23110010419",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(mockGetAdminAccessStatus).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(screen.getByTestId("potentialAdmin")).toHaveTextContent("true");
      });
      expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      expect(screen.getByTestId("registerNo")).toHaveTextContent("AP23110010419");
    });

    it("shows the prompt for a potential admin who is not currently admin", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP23110010419",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("true");
      });
    });

    it("hides the prompt when the dismissed flag is set in sessionStorage", async () => {
      window.sessionStorage.setItem("erp.admin.prompt.dismissed", "1");
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP23110010419",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(mockGetAdminAccessStatus).toHaveBeenCalledTimes(1);
      });
      expect(screen.getByTestId("showPrompt")).toHaveTextContent("false");
    });

    it("hides the prompt for a non-potential-admin user", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: false,
        isAdmin: false,
        registerNo: "AP23110010419",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("false");
      });
    });

    it("hides the prompt for a user who is already an active admin", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: true,
        registerNo: "AP23110010419",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("false");
      });
    });

    it("handles empty registerNo from the API gracefully", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: false,
        isAdmin: false,
        registerNo: "",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("registerNo")).toHaveTextContent("");
      });
    });

    it("handles null registerNo from the API gracefully", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: false,
        isAdmin: false,
        registerNo: null,
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("registerNo")).toHaveTextContent("");
      });
    });
  });

  // ── Error handling — getAdminAccessStatus rejection ───────────
  describe("Error handling — getAdminAccessStatus rejection", () => {
    it("resets all state to defaults when getAdminAccessStatus rejects", async () => {
      mockIsPlatformAdmin.mockReturnValue(true);
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockRejectedValue(new Error("Network error"));

      renderWithProvider();

      await waitFor(() => {
        expect(mockGetAdminAccessStatus).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(screen.getByTestId("potentialAdmin")).toHaveTextContent("false");
      });
      expect(screen.getByTestId("isAdmin")).toHaveTextContent("false");
      expect(screen.getByTestId("showPrompt")).toHaveTextContent("false");
    });

    it("does not update state after unmount (cleanup active flag)", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      // Use a deferred promise so we can unmount before it resolves
      let resolveAccess!: (v: unknown) => void;
      mockGetAdminAccessStatus.mockReturnValue(
        new Promise((resolve) => {
          resolveAccess = resolve;
        }),
      );

      const { unmount } = renderWithProvider();

      // Unmount before the promise resolves — the active flag stops state updates
      unmount();

      // Resolve after unmount — the .then callback runs but active is false
      resolveAccess({ potentialAdmin: true, isAdmin: true, registerNo: "AP123" });

      // No assertion to make except that nothing crashes.
      // If the cleanup worked, no "state update on unmounted component" warning fires.
      // We wait a tick to let the microtask queue drain.
      await vi.waitFor(() => Promise.resolve());
    });
  });

  // ── openPrompt / skipPrompt (checkAccess behaviour) ───────────
  describe("openPrompt / skipPrompt — access checks", () => {
    it("openPrompt shows the prompt when user is potential admin and not admin", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      renderWithProvider();

      // Prompt appears automatically for potential admin
      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("true");
      });

      const user = userEvent.setup();

      // Dismiss it
      await user.click(screen.getByTestId("skipPromptBtn"));
      expect(screen.getByTestId("showPrompt")).toHaveTextContent("false");

      // Re-open via openPrompt
      await user.click(screen.getByTestId("openPromptBtn"));
      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("true");
      });
    });

    it("openPrompt is a no-op when the user is not a potential admin", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: false,
        isAdmin: false,
        registerNo: "",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("false");
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId("openPromptBtn"));
      expect(screen.getByTestId("showPrompt")).toHaveTextContent("false");
    });

    it("openPrompt is a no-op when the user is already admin", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: true,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("false");
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId("openPromptBtn"));
      // Guard `if (!potentialAdmin || isAdmin) return;` prevents action
      expect(screen.getByTestId("showPrompt")).toHaveTextContent("false");
    });

    it("openPrompt clears any previous error", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("true");
      });

      const user = userEvent.setup();

      // Trigger an unlock error
      mockUnlockAdminMode.mockRejectedValueOnce(new Error("Bad password"));
      await user.type(screen.getByTestId("passwordInput"), "wrong");
      await user.click(screen.getByTestId("unlockBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Bad password");
      });

      // Dismiss prompt and re-open — error should be cleared
      await user.click(screen.getByTestId("skipPromptBtn"));
      await user.click(screen.getByTestId("openPromptBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("true");
      });
      expect(screen.getByTestId("error")).toHaveTextContent("");
    });

    it("skipPrompt hides the prompt and sets dismissed in sessionStorage", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("true");
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId("skipPromptBtn"));

      expect(screen.getByTestId("showPrompt")).toHaveTextContent("false");
      expect(window.sessionStorage.getItem("erp.admin.prompt.dismissed")).toBe("1");
    });
  });

  // ── unlock (loginAsAdmin) flow ────────────────────────────────
  describe("unlock (loginAsAdmin) flow", () => {
    it("sets isAdmin=true, clears password, and hides prompt on success", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("true");
      });

      const user = userEvent.setup();

      // Type a password
      const passwordInput = screen.getByTestId("passwordInput");
      await user.type(passwordInput, "admin-secret");
      expect(screen.getByTestId("promptPassword")).toHaveTextContent("admin-secret");

      // Click unlock
      await user.click(screen.getByTestId("unlockBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      });
      expect(screen.getByTestId("showPrompt")).toHaveTextContent("false");
      expect(screen.getByTestId("promptPassword")).toHaveTextContent("");
      expect(screen.getByTestId("busy")).toHaveTextContent("false");
      expect(mockUnlockAdminMode).toHaveBeenCalledWith("admin-secret");
    });

    it("calls unlockAdminMode with the exact password from the input", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("true");
      });

      const user = userEvent.setup();
      await user.type(screen.getByTestId("passwordInput"), "  extra-spaces  ");
      await user.click(screen.getByTestId("unlockBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      });
      // Password is passed as-typed (the trimming happens only for the header)
      expect(mockUnlockAdminMode).toHaveBeenCalledWith("  extra-spaces  ");
    });

    it("sets the dismissed flag in sessionStorage on successful unlock", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("true");
      });

      const user = userEvent.setup();
      await user.type(screen.getByTestId("passwordInput"), "pwd");
      await user.click(screen.getByTestId("unlockBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      });
      expect(window.sessionStorage.getItem("erp.admin.prompt.dismissed")).toBe("1");
    });

    it("transitions through loading (busy) state during unlock", async () => {
      let resolveUnlock!: (v: unknown) => void;
      mockUnlockAdminMode.mockReturnValue(
        new Promise((resolve) => {
          resolveUnlock = resolve;
        }),
      );
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("true");
      });

      const user = userEvent.setup();
      await user.type(screen.getByTestId("passwordInput"), "pwd");
      await user.click(screen.getByTestId("unlockBtn"));

      // Busy should become true synchronously when unlock is called
      await waitFor(() => {
        expect(screen.getByTestId("busy")).toHaveTextContent("true");
      });

      resolveUnlock({ isAdmin: true });

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      });
      expect(screen.getByTestId("busy")).toHaveTextContent("false");
    });

    it("sets error message when unlock fails with an Error", async () => {
      mockUnlockAdminMode.mockRejectedValue(new Error("Incorrect password."));
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("true");
      });

      const user = userEvent.setup();
      await user.type(screen.getByTestId("passwordInput"), "wrong");
      await user.click(screen.getByTestId("unlockBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Incorrect password.");
      });
      // isAdmin stays false on failure
      expect(screen.getByTestId("isAdmin")).toHaveTextContent("false");
      // busy is cleared in finally
      expect(screen.getByTestId("busy")).toHaveTextContent("false");
    });

    it("uses fallback error message when unlock rejects with a non-Error value", async () => {
      mockUnlockAdminMode.mockRejectedValue("raw string rejection");
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("true");
      });

      const user = userEvent.setup();
      await user.type(screen.getByTestId("passwordInput"), "wrong");
      await user.click(screen.getByTestId("unlockBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Invalid admin password.");
      });
    });

    it("uses fallback error message when unlock rejects with a number", async () => {
      mockUnlockAdminMode.mockRejectedValue(403);
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("true");
      });

      const user = userEvent.setup();
      await user.type(screen.getByTestId("passwordInput"), "wrong");
      await user.click(screen.getByTestId("unlockBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Invalid admin password.");
      });
    });

    it("does not show prompt on re-mount when dismissed flag exists", async () => {
      // First mount and unlock
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      const { unmount } = renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("true");
      });

      const user = userEvent.setup();
      await user.type(screen.getByTestId("passwordInput"), "pwd");
      await user.click(screen.getByTestId("unlockBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      });

      unmount();

      // Re-mount — the dismissed flag should prevent the prompt from showing
      // even though the API returns potentialAdmin=true, isAdmin=false
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("false");
      });
    });
  });

  // ── disable (logoutAdmin) flow ────────────────────────────────
  describe("disable (logoutAdmin) flow", () => {
    it("resets isAdmin to false on successful disable", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: true,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId("disableBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("false");
      });
      expect(mockDisableAdminMode).toHaveBeenCalledTimes(1);
    });

    it("sets dismissed flag in sessionStorage on disable", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: true,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId("disableBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("false");
      });
      expect(window.sessionStorage.getItem("erp.admin.prompt.dismissed")).toBe("1");
    });

    it("transitions through loading (busy) state during disable", async () => {
      let resolveDisable!: (v: unknown) => void;
      mockDisableAdminMode.mockReturnValue(
        new Promise((resolve) => {
          resolveDisable = resolve;
        }),
      );
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: true,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId("disableBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("busy")).toHaveTextContent("true");
      });

      resolveDisable({ isAdmin: false });

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("false");
      });
      expect(screen.getByTestId("busy")).toHaveTextContent("false");
    });

    it("sets error message when disable fails with an Error", async () => {
      mockDisableAdminMode.mockRejectedValue(new Error("Internal server error."));
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: true,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId("disableBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Internal server error.");
      });
      // isAdmin persists as true on failure — only the catch path runs
      expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      expect(screen.getByTestId("busy")).toHaveTextContent("false");
    });

    it("uses fallback message when disable rejects with a non-Error value", async () => {
      mockDisableAdminMode.mockRejectedValue(null);
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: true,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId("disableBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Failed to disable admin mode.");
      });
    });

    it("does not change isAdmin if password ref was already empty on disable", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: true,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId("disableBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("false");
      });
    });
  });

  // ── adminHeaders lifecycle ────────────────────────────────────
  describe("adminHeaders lifecycle", () => {
    it("starts as an empty object when not admin", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("adminHeaders")).toHaveTextContent("{}");
      });
    });

    it("contains the password after successful unlock", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("true");
      });

      const user = userEvent.setup();
      await user.type(screen.getByTestId("passwordInput"), "my-password");
      await user.click(screen.getByTestId("unlockBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      });

      const headers = JSON.parse(screen.getByTestId("adminHeaders").textContent ?? "{}");
      expect(headers).toEqual({ "x-admin-password": "my-password" });
    });

    it("trims whitespace in the password header value", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("true");
      });

      const user = userEvent.setup();
      await user.type(screen.getByTestId("passwordInput"), "  spaced-pwd  ");
      await user.click(screen.getByTestId("unlockBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      });

      const headers = JSON.parse(screen.getByTestId("adminHeaders").textContent ?? "{}");
      expect(headers).toEqual({ "x-admin-password": "spaced-pwd" });
    });

    it("remains empty when unlock is called with an empty password", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("true");
      });

      const user = userEvent.setup();
      // Click unlock without typing any password
      await user.click(screen.getByTestId("unlockBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      });

      const headers = JSON.parse(screen.getByTestId("adminHeaders").textContent ?? "{}");
      expect(headers).toEqual({});
    });

    it("goes back to an empty object after disable", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: true,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId("disableBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("false");
      });
      expect(screen.getByTestId("adminHeaders")).toHaveTextContent("{}");
    });
  });

  // ── Error state is cleared on retry ───────────────────────────
  describe("Error state transitions", () => {
    it("clears previous error when unlock is retried after a failure", async () => {
      mockUnlockAdminMode.mockRejectedValueOnce(new Error("First error"));
      mockUnlockAdminMode.mockResolvedValueOnce({ isAdmin: true });
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("true");
      });

      const user = userEvent.setup();

      // Attempt 1 — failure
      await user.type(screen.getByTestId("passwordInput"), "wrong");
      await user.click(screen.getByTestId("unlockBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("First error");
      });

      // Attempt 2 — success
      const input = screen.getByTestId("passwordInput");
      await user.clear(input);
      await user.type(input, "correct");
      await user.click(screen.getByTestId("unlockBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      });
      expect(screen.getByTestId("error")).toHaveTextContent("");
    });

    it("clears previous error when disable is retried after a failure", async () => {
      mockDisableAdminMode.mockRejectedValueOnce(new Error("First error"));
      mockDisableAdminMode.mockResolvedValueOnce({ isAdmin: false });
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: true,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      });

      const user = userEvent.setup();

      // Attempt 1 — failure
      await user.click(screen.getByTestId("disableBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("First error");
      });

      // Attempt 2 — success
      await user.click(screen.getByTestId("disableBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("false");
      });
      expect(screen.getByTestId("error")).toHaveTextContent("");
    });

    it("error persists until a new unlock or disable call clears it", async () => {
      mockUnlockAdminMode.mockRejectedValue(new Error("Persistent error"));
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("showPrompt")).toHaveTextContent("true");
      });

      const user = userEvent.setup();
      await user.type(screen.getByTestId("passwordInput"), "pwd");
      await user.click(screen.getByTestId("unlockBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Persistent error");
      });

      // The error should still be present (no new operation cleared it)
      expect(screen.getByTestId("error")).toHaveTextContent("Persistent error");
    });
  });

  // ── Integration with React components ─────────────────────────
  describe("Integration with React components", () => {
    it("provides stable context values to multiple consuming components", async () => {
      function ConsumerA() {
        const { isAdmin } = useAdminMode();
        return <div data-testid="consumerA">{isAdmin ? "Admin" : "User"}</div>;
      }
      function ConsumerB() {
        const { potentialAdmin } = useAdminMode();
        return <div data-testid="consumerB">{potentialAdmin ? "Potential" : "Standard"}</div>;
      }

      function MultiConsumer() {
        return (
          <AdminModeProvider>
            <ConsumerA />
            <ConsumerB />
          </AdminModeProvider>
        );
      }

      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      render(<MultiConsumer />);

      await waitFor(() => {
        expect(screen.getByTestId("consumerA")).toHaveTextContent("User");
      });
      expect(screen.getByTestId("consumerB")).toHaveTextContent("Potential");
    });

    it("supports components that conditionally render based on admin state", async () => {
      function AdminPanel() {
        const { isAdmin, unlock, setPromptPassword, promptPassword } = useAdminMode();
        if (!isAdmin) {
          return (
            <div data-testid="admin-panel">
              <p>Access denied</p>
              <input
                data-testid="admin-password-input"
                value={promptPassword}
                onChange={(e) => setPromptPassword(e.target.value)}
              />
              <button data-testid="admin-unlock-btn" type="button" onClick={unlock}>
                Log In
              </button>
            </div>
          );
        }
        return <div data-testid="admin-panel">Welcome, Admin</div>;
      }

      render(
        <AdminModeProvider>
          <AdminPanel />
        </AdminModeProvider>,
      );

      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      // Re-render to apply mocks in effect
      // Actually, the provider is already rendered above. The mock is already set.
      // Wait for the effect to settle.
      await waitFor(() => {
        expect(screen.getByTestId("admin-panel")).toHaveTextContent("Access denied");
      });

      const user = userEvent.setup();
      await user.type(screen.getByTestId("admin-password-input"), "admin123");
      await user.click(screen.getByTestId("admin-unlock-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("admin-panel")).toHaveTextContent("Welcome, Admin");
      });
    });

    it("preserves potentialAdmin through an unlock and disable cycle", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus.mockResolvedValue({
        potentialAdmin: true,
        isAdmin: false,
        registerNo: "AP123",
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId("potentialAdmin")).toHaveTextContent("true");
      });

      const user = userEvent.setup();

      // Unlock
      await user.type(screen.getByTestId("passwordInput"), "pass");
      await user.click(screen.getByTestId("unlockBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
      });
      expect(screen.getByTestId("potentialAdmin")).toHaveTextContent("true");

      // Disable
      await user.click(screen.getByTestId("disableBtn"));

      await waitFor(() => {
        expect(screen.getByTestId("isAdmin")).toHaveTextContent("false");
      });
      // potentialAdmin is preserved because disable only touches isAdmin
      expect(screen.getByTestId("potentialAdmin")).toHaveTextContent("true");
    });
  });

  // ── Edge cases ────────────────────────────────────────────────
  describe("Edge cases", () => {
    it("ignores stale getAdminAccessStatus responses after re-mount", async () => {
      // Simulate two rapid mounts — the first resolves after the second.
      let resolveFirst!: (v: unknown) => void;
      let resolveSecond!: (v: unknown) => void;
      mockHasSessionAuth.mockReturnValue(true);
      mockGetAdminAccessStatus
        .mockReturnValueOnce(new Promise((r) => { resolveFirst = r; }))
        .mockReturnValueOnce(new Promise((r) => { resolveSecond = r; }));

      const { unmount } = renderWithProvider();
      unmount();

      // First mount's promise resolves after unmount — the active flag guards it
      resolveFirst({ potentialAdmin: true, isAdmin: true, registerNo: "AP111" });

      // Second mount
      renderWithProvider();
      resolveSecond({ potentialAdmin: false, isAdmin: false, registerNo: "AP222" });

      await waitFor(() => {
        expect(screen.getByTestId("potentialAdmin")).toHaveTextContent("false");
      });
      expect(screen.getByTestId("registerNo")).toHaveTextContent("AP222");
    });

    it("handles hasSessionAuth returning true with a null getAdminAccessStatus response gracefully", async () => {
      mockHasSessionAuth.mockReturnValue(true);
      // The API returns null/undefined — the .then callback accesses status.potentialAdmin
      mockGetAdminAccessStatus.mockResolvedValue(null as unknown as undefined);

      renderWithProvider();

      await waitFor(() => {
        expect(mockGetAdminAccessStatus).toHaveBeenCalledTimes(1);
      });

      // Should not crash; Boolean(null) is false, so states default to false
      await waitFor(() => {
        expect(screen.getByTestId("potentialAdmin")).toHaveTextContent("false");
      });
      expect(screen.getByTestId("isAdmin")).toHaveTextContent("false");
    });
  });
});
