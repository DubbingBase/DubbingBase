import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineNuxtConfig({
  rootDir: import.meta.dirname,
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
    "@nuxt/fonts",
    "@vueuse/nuxt",
    "@nuxtjs/i18n",
    "@nuxtjs/supabase",
    "@nuxtjs/sitemap",
    "@nuxtjs/robots",
    "@nuxt/image",
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
      { code: "en", file: "en.json", name: "English" },
      { code: "fr", file: "fr.json", name: "Français" },
    ],
    defaultLocale: "en",
    strategy: "prefix",
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "user_lang",
      redirectOn: "root", // Only redirect on root path /
    },
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
