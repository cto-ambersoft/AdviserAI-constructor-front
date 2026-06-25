import { defineConfig } from "vitest/config";

// Frontend unit tests (pure logic + light component rendering). esbuild handles
// JSX via tsconfig's `jsx: react-jsx`; no vite React plugin is needed (and it
// would pull a conflicting @babel/core@8). — Phase 4 review S4.
export default defineConfig({
  resolve: {
    alias: { "@": new URL("./", import.meta.url).pathname },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
  },
});
