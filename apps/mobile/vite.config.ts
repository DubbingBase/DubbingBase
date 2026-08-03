/// <reference types="vitest" />

import vue from "@vitejs/plugin-vue";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import Icons from "unplugin-icons/vite";
import tailwindcss from "@tailwindcss/vite";
import vueDevTools from "vite-plugin-vue-devtools";

// https://vitejs.dev/config/
export default ({ mode }) => {
  console.log("mode", mode);
  const env = loadEnv(mode, process.cwd());
  console.log("env", env);

  const requiredEnvs = [
    "VITE_ONESIGNAL_APP_ID",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY"
  ];
  
  const missingEnvs = requiredEnvs.filter((key) => !env[key]);
  
  if (missingEnvs.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvs.join(', ')}. Please check your .env file.`);
  }
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
        "@": path.resolve(__dirname, "./src"),
        "@app/supabase": path.resolve(__dirname, "../../packages/database"),
        "@supabase/functions": path.resolve(
          __dirname,
          "../../packages/database/supabase/functions",
        ),
      },
      dedupe: ["vue-router", "@ionic/vue-router", "vue"],
    },
    test: {
      globals: true,
      environment: "jsdom",
    },
  });
};
