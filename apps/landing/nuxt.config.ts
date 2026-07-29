import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineNuxtConfig({
  compatibilityDate: "2024-04-03",

  nitro: {
    preset: "cloudflare-pages",
    prerender: {
      autoSubfolderIndex: false,
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  css: ["~/assets/main.css"],

  modules: ["@vueuse/nuxt", "@nuxtjs/i18n", "@nuxtjs/supabase"],

  i18n: {
    locales: [
      { code: "en", file: "en.ts" },
      { code: "fr", file: "fr.ts" },
    ],
    lazy: true,
    langDir: "../locales",
    defaultLocale: "fr",
  },

  supabase: {
    redirect: false,
    types: resolve(
      import.meta.dirname,
      "../../packages/database/supabase/functions/_shared/database.types.ts",
    ),
  },

  srcDir: "src/",
});
