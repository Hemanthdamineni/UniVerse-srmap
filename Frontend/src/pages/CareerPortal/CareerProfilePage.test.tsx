import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import CareerProfilePage from "./CareerProfilePage";

const getProfile = vi.fn();
const updateProfile = vi.fn(() => Promise.resolve({ updated: true }));
const uploadResume = vi.fn(() => Promise.resolve({ url: "/f.pdf", fileName: "f.pdf" }));

vi.mock("../../lib/careerApi", () => ({
  get getProfile() {
    return getProfile;
  },
  get updateProfile() {
    return updateProfile;
  },
  get uploadResume() {
    return uploadResume;
  },
}));

vi.mock("../../hooks/useSession", () => ({
  useSession: () => ({ profile: null, loading: false }),
}));

describe("CareerProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProfile.mockResolvedValue({
      userId: "u1",
      skills: ["Rust"],
      preferredTypes: [],
      preferredLocations: ["Remote"],
      minStipend: "",
      linkedinUrl: "",
      githubUrl: "",
      portfolioUrl: "",
      updatedAt: "2026-01-01",
    });
  });

  it("loads profile and saves changes", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CareerProfilePage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Rust")).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText("LinkedIn URL"), "https://linkedin.com/in/me");
    await user.click(screen.getByRole("button", { name: /Save Changes/i }));
    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
  });

  it("adds a skill via input and plus button", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CareerProfilePage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Rust")).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText(/Python, React/i), "Go");
    const plusButtons = screen.getAllByRole("button").filter((b) => b.querySelector("svg.lucide-plus"));
    await user.click(plusButtons[0]);
    await waitFor(() => expect(screen.getByText("Go")).toBeInTheDocument());
  });

  it("uploads resume when file selected", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CareerProfilePage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText(/Career Profile/i)).toBeInTheDocument());
    const input = document.getElementById("resume-upload") as HTMLInputElement;
    expect(input).toBeTruthy();
    const file = new File(["%PDF"], "cv.pdf", { type: "application/pdf" });
    await user.upload(input, file);
    await waitFor(() => expect(uploadResume).toHaveBeenCalledWith(file));
  });
});
