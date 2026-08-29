import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { defineNuxtConfig } from "nuxt/config";
import {
  APP_LOCALES,
  DEFAULT_LOCALE,
  NON_DEFAULT_LOCALES,
  MEDIA_ROUTE_PREFIXES,
} from "@app/shared-logic";

const SWR_CONFIG = {
  swr: process.env.NODE_ENV === "development" ? false : 3600,
};

function generateRouteRules() {
  const rules: Record<string, typeof SWR_CONFIG> = {};
  for (const prefix of MEDIA_ROUTE_PREFIXES) {
    rules[`/${prefix}/**`] = SWR_CONFIG;
    for (const locale of NON_DEFAULT_LOCALES) {
      rules[`/${locale}/${prefix}/**`] = SWR_CONFIG;
    }
  }
  return rules;
}

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
        kv_namespaces: [
          {
            binding: "CACHE_KV",
            id: "340974572b504ed2aa20c160e18f5697",
          },
        ],
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
      supabaseUrl:
        process.env.NUXT_PUBLIC_SUPABASE_URL || "https://mock.supabase.co",
      supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_KEY || "mock-anon-key",
    },
  },

  supabase: {
    url: process.env.NUXT_PUBLIC_SUPABASE_URL || "https://mock.supabase.co",
    key: process.env.NUXT_PUBLIC_SUPABASE_KEY || "mock-anon-key",
    redirect: false,
    types: resolve(
      import.meta.dirname,
      "../../packages/database/src/database.types.ts",
    ),
    cookieOptions: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  },

  experimental: {
    inlineRouteRules: true,
  },

  routeRules: generateRouteRules(),

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      dedupe: [
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
    domains: ["image.tmdb.org", "images.igdb.com"],
    format: ["avif", "webp"],
  },

  icon: {
    fallbackToApi: false,
  },

  i18n: {
    locales: APP_LOCALES as any,
    defaultLocale: DEFAULT_LOCALE,
    strategy: "prefix_except_default",
    baseUrl: "https://dubbingbase.com",
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "user_lang",
      redirectOn: "all", // Redirects on all paths (fixes 404 on URLs without language prefix)
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
