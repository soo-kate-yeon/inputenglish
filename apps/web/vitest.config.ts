import { defineConfig } from "vitest/config";
import path from "node:path";

const sharedSrc = path.resolve(__dirname, "../../packages/shared/src");

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "../../packages/shared/src/**/*.test.ts",
    ],
    restoreMocks: true,
    clearMocks: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@inputenglish/shared": sharedSrc,
    },
  },
});
