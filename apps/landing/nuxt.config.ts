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

  modules: [
    "@vueuse/nuxt",
    "@nuxtjs/i18n",
    "@nuxtjs/supabase",
    "@nuxtjs/sitemap",
    "@nuxtjs/robots",
    "@nuxt/image"
  ],

  site: {
    url: "https://dubbingbase.com",
    name: "DubbingBase",
  },

  image: {
    domains: ["image.tmdb.org"],
  },

  i18n: {
    locales: [
      { code: "en", file: "en.json" },
      { code: "fr", file: "fr.json" },
    ],
    defaultLocale: "en",
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
