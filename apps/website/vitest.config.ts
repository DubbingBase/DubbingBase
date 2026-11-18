import { resolve } from "node:path";
import { defineVitestConfig } from "@nuxt/test-utils/config";

// The Nuxt test app needs a Supabase URL and key to initialize (the Supabase module throws without
// them, which stops later plugins such as i18n from installing). Unit tests never reach the network.
process.env.SUPABASE_URL ??= "https://mock.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY ??= "mock-publishable-key";

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
