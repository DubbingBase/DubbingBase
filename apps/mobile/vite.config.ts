/// <reference types="vitest" />

import vue from "@vitejs/plugin-vue";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import Icons from "unplugin-icons/vite";
import tailwindcss from "@tailwindcss/vite";
import vueDevTools from "vite-plugin-vue-devtools";

// https://vitejs.dev/config/
export default ({ mode }) => {
  const env = {
    VITE_ONESIGNAL_APP_ID:
      process.env.VITE_ONESIGNAL_APP_ID || "mock-onesignal-id",
    VITE_SUPABASE_URL:
      process.env.VITE_SUPABASE_URL || "https://mock.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY:
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "mock-key",
    ...loadEnv(mode, process.cwd()),
  };
  return defineConfig({
    server: {
      port: 1420,
      strictPort: true,
      proxy: {
        "/supabase-api": {
          target: env.VITE_SUPABASE_URL || "http://127.0.0.1:54321",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/supabase-api/, ""),
        },
      },
    },
    plugins: [
      vue({
        template: {
          compilerOptions: {
            isCustomElement: (tag) => tag.startsWith("cap-"),
          },
        },
      }),
      // legacy(),
      tailwindcss(),
      Icons({ compiler: "vue3" }),
      vueDevTools(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
        "@app/supabase": path.resolve(
          import.meta.dirname,
          "../../packages/database",
        ),
      },
      dedupe: [
        "vue-router",
        "@ionic/vue-router",
        "vue",
        "@vue/runtime-core",
        "@vue/runtime-dom",
        "@vue/reactivity",
        "@vue/server-renderer",
        "@vue/shared",
        "@vue/compiler-sfc",
      ],
    },
    define: {
      __VERSION__: JSON.stringify(process.env.npm_package_version || "1.0.0"),
    },
    test: {
      globals: true,
      environment: "jsdom",
    },
  });
};
