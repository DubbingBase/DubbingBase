import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { defineNuxtConfig } from "nuxt/config";
import {
  APP_LOCALES,
  DEFAULT_LOCALE,
  MEDIA_ROUTE_PREFIXES,
  NON_DEFAULT_LOCALES,
} from "@app/shared-logic";

function env(name: string): string | undefined {
  return process.env[name] ?? process.env[`NUXT_${name}`];
}

const supabaseUrl = env("SUPABASE_URL") ?? env("PUBLIC_SUPABASE_URL");
const supabasePublishableKey = env("SUPABASE_PUBLISHABLE_KEY");
const productionRouteRules = Object.fromEntries(
  MEDIA_ROUTE_PREFIXES.flatMap((prefix) => [
    [`/${prefix}/**`, { swr: 3600 }],
    ...NON_DEFAULT_LOCALES.map((locale) => [
      `/${locale}/${prefix}/**`,
      { swr: 3600 },
    ]),
  ]),
);

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
    experimental: {
      tasks: true,
    },
    scheduledTasks: {
      "* * * * *": ["dispatcher"],
    },
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
    supabaseSecretKey: env("SUPABASE_SECRET_KEY"),
    supabaseUrl,
    tmdbApiKey: env("TMDB_API_KEY"),
    tvdbApiKey: env("TVDB_API_KEY"),
    igdbClientId: env("IGDB_CLIENT_ID"),
    igdbClientSecret: env("IGDB_CLIENT_SECRET"),
    googleAiKey: env("GOOGLE_AI_KEY"),
    geminiModel: env("GEMINI_MODEL") || "gemini-3.5-flash-lite",
    geminiModels: env("GEMINI_MODELS"),
    groqApiKey: env("GROQ_API_KEY"),
    groqModel: env("GROQ_MODEL") || "openai/gpt-oss-120b",
    llmProvider: env("LLM_PROVIDER") || "gemini",
    onesignalAppId: env("ONESIGNAL_APP_ID"),
    onesignalRestApiKey: env("ONESIGNAL_REST_API_KEY"),
    discordWebhookDiscoveryUrl:
      env("DISCORD_WEBHOOK_DISCOVERY_URL") ||
      env("DISCORD_DISCOVERY_WEBHOOK_URL"),
    discordWebhookCheckUrl:
      env("DISCORD_WEBHOOK_CHECK_URL") || env("DISCORD_CHECK_WEBHOOK_URL"),
    discordWebhookExtractUrl:
      env("DISCORD_WEBHOOK_EXTRACT_URL") || env("DISCORD_EXTRACT_WEBHOOK_URL"),
    discordWebhookUrl:
      env("DISCORD_WEBHOOK_URL") || env("DISCORD_ADMIN_WEBHOOK_LOG_URL"),
    resendApiKey: env("RESEND_API_KEY"),
    resendFromEmail: env("RESEND_FROM_EMAIL"),
    resendToEmail: env("RESEND_TO_EMAIL"),
    adminEmail: env("ADMIN_EMAIL"),
    public: {
      supabaseUrl: supabaseUrl || "https://mock.supabase.co",
      supabaseKey: supabasePublishableKey || "mock-publishable-key",
    },
  },

  supabase: {
    url: supabaseUrl || "https://mock.supabase.co",
    key: supabasePublishableKey || "mock-publishable-key",
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

  pwa: {
    registerType: "prompt",
    client: {
      installPrompt: "dubbingbase:pwa-install-dismissed",
    },
    manifest: {
      id: "/",
      name: "DubbingBase",
      short_name: "DubbingBase",
      description:
        "The ultimate database for voice actors and dubbing projects.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#121212",
      theme_color: "#121212",
      icons: [
        {
          src: "/android-chrome-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/android-chrome-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        },
      ],
    },
    workbox: {
      navigateFallback: "/offline.html",
      navigateFallbackDenylist: [/^\/api\//, /^\/_nuxt\//],
      globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,webmanifest}"],
      runtimeCaching: [],
    },
  },

  // Never enable Nitro's SWR route cache in development. Production-only
  // rules keep local data and API changes immediately visible to developers.
  routeRules:
    process.env.NODE_ENV === "development" ? {} : productionRouteRules,

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
    "@vite-pwa/nuxt",
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
    langDir: "locales",
    locales: APP_LOCALES as any,
    defaultLocale: DEFAULT_LOCALE,
    strategy: "prefix_except_default",
    baseUrl: "https://dubbingbase.com",
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "user_lang",
      redirectOn: "all",
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
