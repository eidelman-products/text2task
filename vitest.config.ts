import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    // Default environment stays "node" for the existing `.test.ts` suite.
    // New `.test.tsx` component tests opt into jsdom individually via a
    // `// @vitest-environment jsdom` docblock at the top of the file (the
    // other officially supported mechanism -- `environmentMatchGlobs` was
    // removed from Vitest's InlineConfig type as of v4, confirmed via
    // `npx tsc --noEmit` failing against node_modules/vitest's own types).
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
