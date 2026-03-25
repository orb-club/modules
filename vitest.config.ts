import { defineConfig } from "vitest/config";

// Browser-specific suites should opt in per file with `@vitest-environment jsdom`.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    passWithNoTests: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
