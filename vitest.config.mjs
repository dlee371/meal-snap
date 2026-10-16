import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the "@/*" alias from jsconfig.json so tests can import "@/lib/..."
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // Server-only modules (like lib/analyzeMeal.js) can be unit-tested in Node.
      "server-only": fileURLToPath(new URL("./test/server-only-stub.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.js"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
