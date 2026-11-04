import { resolve } from "node:path";
import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
  resolve: {
    alias: {
      "#supabase/server": resolve(
        import.meta.dirname,
        "server/utils/testing/supabase-server-stub.ts",
      ),
    },
  },
  test: {
    environment: "nuxt",
    globals: true,
    hookTimeout: 60000,
    testTimeout: 30000,
  },
});
