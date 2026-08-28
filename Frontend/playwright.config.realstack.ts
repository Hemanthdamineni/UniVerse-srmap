import { defineConfig, devices } from "@playwright/test";

// Real-stack profile (Gate 7 P0). Boots the actual backend in
// fixture-seeded mode and drives Chromium against it. This is the
// profile CI uses for e2e-realstack; the existing
// playwright.config.ts continues to drive the static-prototype
// fixture suite for layout/regression coverage.
//
// Use with:
//   PLAYWRIGHT_PROFILE=realstack npx playwright test
// or pass --config to the run command directly:
//   npx playwright test --config=playwright.config.realstack.ts
//
// Prereq: the backend must be running and reachable. Use the
// e2e-stack launcher at Backend/scripts/e2e-stack/start.sh which
// starts a backend instance with seeded fixtures and dumps it on
// exit. The CI job (e2e-realstack) calls start.sh before this
// profile runs.

const FRONTEND_URL = process.env.E2E_FRONTEND_URL || "http://127.0.0.1:5173";
const BACKEND_URL = process.env.E2E_BACKEND_URL || "http://127.0.0.1:5000";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.realstack\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Real backend + real database; one worker keeps writes
         // serial so the spec suite is deterministic.
  reporter: "list",
  use: {
    baseURL: FRONTEND_URL,
    trace: "on-first-retry",
    // The frontend proxies /api/* to the backend; we use the
    // baseURL for everything (the proxy is configured in
    // vite.config.ts). Tests that need to bypass the proxy can use
    // the BACKEND_URL env var directly.
  },
  projects: [
    {
      name: "realstack-chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } }
          : {}),
      },
    },
  ],
  // No webServer block here — the CI job is responsible for
  // booting the backend and the frontend before invoking this
  // profile. This avoids races between Playwright's auto-restart
  // and the e2e-stack launcher.
  expect: { timeout: 10_000 },
});

// Export the URLs so spec files can use them via
// `import.meta.env` if needed.
export const TEST_BACKEND_URL = BACKEND_URL;
export const TEST_FRONTEND_URL = FRONTEND_URL;
