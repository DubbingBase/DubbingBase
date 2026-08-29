import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
  test: {
    environment: "nuxt",
    globals: true,
    hookTimeout: 60000,
    testTimeout: 30000,
  },
});
