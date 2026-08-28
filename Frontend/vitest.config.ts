import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Force NODE_ENV=test for the test run, regardless of the shell env.
// `@vitejs/plugin-react` (Babel) inspects process.env.NODE_ENV to decide
// between React's dev runtime (which exports `act`, `jsxDEV`, etc.) and
// the production runtime. CI runners and some local shells set
// NODE_ENV=production, which loads react-dom's production build — and
// `act` is not exported there, so every `render(<Component />)` test
// crashes with "React.act is not a function".
process.env.NODE_ENV = "test";
process.env.BABEL_ENV = "test";

// babel-plugin-module-resolver is what @vitejs/plugin-react (Babel-based)
// uses to resolve the `@/...` import alias. Vite's `resolve.alias` doesn't
// flow through the Babel plugin, so without this the path imports break
// in tests (the page under test imports `@/lib/utils`, etc.).
const babelAliasPlugin = [
  "babel-plugin-module-resolver",
  {
    root: [__dirname],
    alias: {
      "@": "./src",
    },
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"],
  },
];

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("test"),
  },
  plugins: [
    react({
      jsxRuntime: "automatic",
      jsxImportSource: "react",
      babel: {
        plugins: [babelAliasPlugin],
        presets: [
          ["@babel/preset-react", { runtime: "automatic" }],
          "@babel/preset-typescript",
        ],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setupTests.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
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
