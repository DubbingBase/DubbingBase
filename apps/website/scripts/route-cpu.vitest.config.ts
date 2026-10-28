import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";

const requireFromNuxt = createRequire(import.meta.resolve("nuxt"));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^h3$/,
        replacement: requireFromNuxt.resolve("h3"),
      },
    ],
  },
  test: {
    environment: "node",
    include: ["scripts/route-cpu.bench.test.ts"],
    maxWorkers: 1,
    pool: "forks",
  },
});
