import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // The real `server-only` package's default export (index.js) always
      // throws -- Next.js's own webpack config aliases it to the package's
      // own no-op `empty.js` specifically when building server-side code,
      // and to the throwing variant only for the client bundle, which is
      // how it enforces "this module cannot be imported from a Client
      // Component." Vitest has no equivalent bundle-target awareness, so
      // every `.server.ts` file in this repo that starts with
      // `import "server-only";` (there are many) needs this same
      // resolution here to be importable in a test at all. Every test in
      // this suite runs as trusted server-side test code, so aliasing to
      // the no-op variant unconditionally (matching Next.js's own
      // server-bundle behavior) is correct, not a workaround.
      "server-only": path.resolve(
        __dirname,
        "node_modules/server-only/empty.js"
      ),
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
