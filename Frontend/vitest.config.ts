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
      include: [
        "src/pages/CareerPortal/**/*.tsx",
        "src/components/career/**/*.tsx",
        "src/lib/careerApi.ts",
        "src/lib/erpProfileCareer.ts",
      ],
      /* Legacy ERP tab modules; imports are out of sync with student careerApi — excluded until wired. */
      exclude: [
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
