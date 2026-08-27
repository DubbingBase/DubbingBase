import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  rootDir: resolve(import.meta.dirname),
  compatibilityDate: "2024-09-23",

  app: {
    head: {
      htmlAttrs: {
        lang: "en",
      },
    },
  },

  nitro: {
    preset: process.env.NITRO_PRESET || "node-server",
    rollupConfig: {
      // Keep .wasm imports external so Rollup's JS plugins (e.g. inject)
      // don't try to parse them. Wrangler pre-compiles them into
      // WebAssembly.Module objects at deploy time (required on Workers,
      // which block WebAssembly.instantiate(bytes)).
      external: [/\.wasm($|\?)/],
    },
    cloudflare: {
      wrangler: {
        kv_namespaces: [{ binding: "CACHE_KV", id: "340974572b504ed2aa20c160e18f5697" }],
      },
    },
  },

  runtimeConfig: {
    supabaseSecretKey: process.env.NUXT_SUPABASE_SECRET_KEY,
    supabaseUrl: process.env.NUXT_SUPABASE_URL,
    tmdbApiKey: process.env.NUXT_TMDB_API_KEY,
    tvdbApiKey: process.env.NUXT_TVDB_API_KEY,
    igdbClientId: process.env.NUXT_IGDB_CLIENT_ID,
    igdbClientSecret: process.env.NUXT_IGDB_CLIENT_SECRET,
    googleAiKey: process.env.NUXT_GOOGLE_AI_KEY,
    groqApiKey: process.env.NUXT_GROQ_API_KEY,
    onesignalAppId: process.env.NUXT_ONESIGNAL_APP_ID,
    onesignalRestApiKey: process.env.NUXT_ONESIGNAL_REST_API_KEY,
    discordWebhookUrl: process.env.NUXT_DISCORD_WEBHOOK_URL,
    resendApiKey: process.env.NUXT_RESEND_API_KEY,
    resendFromEmail: process.env.NUXT_RESEND_FROM_EMAIL,
    resendToEmail: process.env.NUXT_RESEND_TO_EMAIL,
    adminEmail: process.env.NUXT_ADMIN_EMAIL,
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_KEY,
    },
  },

  experimental: {
    inlineRouteRules: true,
  },

  wasm: {
    esmImport: true,
  },

  routeRules: {
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
    "@nuxt/fonts",
    "@nuxt/image",
    "@nuxt/icon",
    "nuxt-swiper",
    "@nuxt/test-utils/module",
    "@nuxtjs/html-validator",
  ],

  // @ts-ignore
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
      { code: "es", language: "es-ES", file: "es.json", name: "Español" },
      { code: "ja", language: "ja-JP", file: "ja.json", name: "日本語" },
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
    url: process.env.NUXT_PUBLIC_SUPABASE_URL,
    key: process.env.NUXT_PUBLIC_SUPABASE_KEY,
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
  // Cloudflare cache is purged after each website deploy (see pipeline.yml)
});
