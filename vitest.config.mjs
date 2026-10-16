import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Mirror the "@/*" alias from jsconfig.json so tests can import "@/lib/..."
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["**/*.test.js"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
