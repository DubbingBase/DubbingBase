/// <reference types="vitest" />

import vue from "@vitejs/plugin-vue";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import Icons from "unplugin-icons/vite";
import vueDevTools from "vite-plugin-vue-devtools";

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default ({ mode }) => {
  console.log("mode", mode);
  const env = loadEnv(mode, process.cwd());
  console.log("env", env);
  return defineConfig({
    server: {
      host: host || false,
      port: 1420,
      strictPort: true,
      hmr: host
        ? {
          protocol: "ws",
          host,
          port: 1421,
        }
        : undefined,
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
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
    },
  });
};
