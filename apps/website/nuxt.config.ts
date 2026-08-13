import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineNuxtConfig({
  rootDir: import.meta.dirname,
  compatibilityDate: "2024-04-03",

  nitro: {
    preset: "cloudflare-pages",
  },

  routeRules: {
    // Prerender static content pages at build time
    "/about": { prerender: true },
    "/legal": { prerender: true },
    "/privacy": { prerender: true },
    "/terms": { prerender: true },
    "/guidelines": { prerender: true },

    // Cache media pages at the edge for 1 hour (stale-while-revalidate) in production only
    "/movie/**": { swr: process.env.NODE_ENV === "development" ? false : 3600 },
    "/show/**": { swr: process.env.NODE_ENV === "development" ? false : 3600 },
    "/game/**": { swr: process.env.NODE_ENV === "development" ? false : 3600 },
    "/actor/**": { swr: process.env.NODE_ENV === "development" ? false : 3600 },
    "/voice-actor/**": {
      swr: process.env.NODE_ENV === "development" ? false : 3600,
    },
  },

  vite: {
    plugins: [tailwindcss()],
    define: {
      __VERSION__: JSON.stringify(process.env.npm_package_version || "1.0.0"),
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "true",
    },
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
    "@nuxt/icon",
    "nuxt-swiper",
    "@nuxt/test-utils/module",
    "@nuxtjs/html-validator",
  ],

  fonts: {
    experimental: {
      processCSSVariables: true,
    },
    families: [
      { name: "Inter", provider: "google", display: "block", preload: true },
    ],
  },

  site: {
    url: "https://dubbingbase.com",
    name: "DubbingBase",
  },

  image: {
    domains: ["image.tmdb.org"],
    format: ["avif", "webp"],
  },

  icon: {
    fallbackToApi: false,
  },

  i18n: {
    locales: [
      { code: "en", language: "en-US", file: "en.json", name: "English" },
      { code: "fr", language: "fr-FR", file: "fr.json", name: "Français" },
    ],
    defaultLocale: "en",
    strategy: "prefix_except_default",
    baseUrl: "https://dubbingbase.com",
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "user_lang",
      redirectOn: "all", // Redirects on all paths (fixes 404 on URLs without language prefix)
    },
  },

  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_PUBLISHABLE_KEY,
    redirect: false,
    types: resolve(
      import.meta.dirname,
      "../../packages/database/supabase/functions/_shared/database.types.ts",
    ),
    cookieOptions: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  },

  srcDir: "src/",
  sourcemap: {
    server: true,
    client: true,
  },
  sitemap: {
    zeroRuntime: true,
  },
});
