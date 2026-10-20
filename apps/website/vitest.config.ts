import { fileURLToPath } from "node:url";
import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
  resolve: {
    alias: {
      "@supabase/realtime-js": fileURLToPath(
        new URL("./tooling/supabase-realtime-disabled.ts", import.meta.url),
      ),
    },
  },
  test: {
    server: { deps: { inline: ["@supabase/supabase-js"] } },
    environment: "nuxt",
    globals: true,
    hookTimeout: 60000,
    testTimeout: 30000,
  },
});
