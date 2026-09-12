import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DownloadAppPage from "./DownloadAppPage";
import { ANDROID_APK_DOWNLOAD_URL } from "../../config/nativeApp";

function renderPage() {
  return render(
    <MemoryRouter>
      <DownloadAppPage />
    </MemoryRouter>
  );
}

describe("DownloadAppPage", () => {
  it("links the Android download button straight at the APK asset", () => {
    renderPage();
    const link = screen.getByRole("link", { name: /download for android/i });
    expect(link).toHaveAttribute("href", ANDROID_APK_DOWNLOAD_URL);
  });

  it("gives Android install steps and an iOS Add to Home Screen alternative", () => {
    renderPage();
    expect(screen.getByText(/allow "install unknown apps"/i)).toBeInTheDocument();
    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument();
  });

  it("links back to login", () => {
    renderPage();
    expect(screen.getByRole("link", { name: /back to login/i })).toHaveAttribute("href", "/login");
  });
});
