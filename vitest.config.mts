import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` llança error fora del bundler de Next; als tests el substituïm per un mòdul buit.
      "server-only": path.resolve(import.meta.dirname, "tests/support/empty.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["tests/support/env.ts"],
    // Els tests d'integració comparteixen la base de dades local: un fitxer rere l'altre.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
