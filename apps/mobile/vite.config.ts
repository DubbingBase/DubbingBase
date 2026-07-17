/// <reference types="vitest" />

import vue from "@vitejs/plugin-vue";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import Icons from "unplugin-icons/vite";
import vueDevTools from "vite-plugin-vue-devtools";

// https://vitejs.dev/config/
export default ({ mode }) => {
  console.log("mode", mode);
  const env = loadEnv(mode, process.cwd());
  console.log("env", env);
  return defineConfig({
    server: {
      port: 1420,
      strictPort: true,
    },
    plugins: [
      vue(),
      // legacy(),
      Icons({ compiler: "vue3" }),
      vueDevTools(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@app/supabase": path.resolve(__dirname, "../../packages/database"),
        "@supabase/functions": path.resolve(
          __dirname,
          "../../packages/database/supabase/functions",
        ),
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
    },
  });
};
