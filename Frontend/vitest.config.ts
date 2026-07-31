import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setupTests.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**"],
      exclude: [
        // Test infrastructure & config
        "src/test/**",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/**/__mocks__/**",

        // Type declarations (no executable code)
        "src/**/*.d.ts",
        "src/vite-env.d.ts",

        // Static assets & styles (not testable JS/TS)
        "src/assets/**",
        "src/styles/**",

        // Prototype / debug utilities (fixture data, not production code)
        "src/lib/prototype/**",

        // Legacy ERP tab modules — imports are out of sync with student
        // careerApi; excluded until wired.
        "src/pages/CareerPortal/Opportunities.tsx",
        "src/pages/CareerPortal/AlumniConnect.tsx",
        "src/pages/CareerPortal/InterviewBooking.tsx",
        "src/pages/CareerPortal/ResumeProfile.tsx",
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 65,
      },
    },
  },
});
