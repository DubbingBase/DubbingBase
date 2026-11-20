import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { defineNuxtConfig } from "nuxt/config";
import { APP_LOCALES, DEFAULT_LOCALE } from "@app/shared-logic";
import { version as appVersion } from "./package.json";

function env(name: string): string | undefined {
  return process.env[name] ?? process.env[`NUXT_${name}`];
}

const supabaseUrl = env("SUPABASE_URL") ?? env("PUBLIC_SUPABASE_URL");
const supabasePublishableKey = env("SUPABASE_PUBLISHABLE_KEY");
const siteUrl = env("SITE_URL") ?? "https://dubbingbase.com";
const isE2E = process.env.E2E_TEST === "true";
// Scripts/route-cpu-ssr.mjs rewrites this exact line to also disable tasks while profiling.
const disableScheduledTasks = isE2E;
const isProduction = process.env.NODE_ENV === "production";
let entryStylesheet = "";
// One prerendered About page per locale; the default locale has no prefix.
const ABOUT_PRERENDER_ROUTES = APP_LOCALES.map((locale) =>
  locale.code === DEFAULT_LOCALE ? "/about" : `/${locale.code}/about`,
);

// Admin pages sit behind the admin middleware and are never indexed, so they render in the
// browser only. Nuxt then leaves their code out of the Worker bundle instead of shipping it for SSR.
const ADMIN_SPA_ROUTE_RULES = Object.fromEntries(
  APP_LOCALES.map((locale) => [
    locale.code === DEFAULT_LOCALE ? "/admin/**" : `/${locale.code}/admin/**`,
    { ssr: false },
  ]),
);

export default defineNuxtConfig({
  rootDir: resolve(import.meta.dirname),
  compatibilityDate: "2026-09-08",

  app: {
    head: {
      htmlAttrs: {
        lang: "en",
      },
    },
  },

  // Nuxt DevTools injects a full-viewport always-on-top overlay (vue-tracer) and a floating pill,
  // which get in the way of element pickers such as Paseo's design mode.
  devtools: { enabled: false },

  nitro: {
    preset: process.env.NITRO_PRESET || "node-server",
    // The Playwright mock interceptor is only compiled for E2E runs so its
    // fixtures never ship in (or add a per-request check to) the production bundle.
    ignore: ["**/*.test.ts", ...(isE2E ? [] : ["**/middleware/00-e2e-mock.ts"])],
    // Dev only: the browser reaches Supabase through /supabase (see plugins/dev-supabase-proxy.client.ts),
    // so the site works from any host. ws keeps Realtime working.
    devProxy: supabaseUrl
      ? { "/supabase": { target: supabaseUrl, changeOrigin: true, ws: true } }
      : {},
    prerender: {
      routes: [...ABOUT_PRERENDER_ROUTES, "/robots.txt"],
    },
    experimental: {
      tasks: true,
    },
    scheduledTasks: disableScheduledTasks
      ? {}
      : {
          "* * * * *": ["dispatcher"],
          "0 6 * * *": ["enqueue-trending-media"],
        },
  },

  routeRules: ADMIN_SPA_ROUTE_RULES,

  runtimeConfig: {
    homepageStylesheet: "",
    supabaseSecretKey: env("SUPABASE_SECRET_KEY"),
    supabaseUrl,
    tmdbApiKey: env("TMDB_API_KEY"),
    tvdbApiKey: env("TVDB_API_KEY"),
    igdbClientId: env("IGDB_CLIENT_ID"),
    igdbClientSecret: env("IGDB_CLIENT_SECRET"),
    googleAiKey: env("GOOGLE_AI_KEY"),
    geminiModels: env("GEMINI_MODELS"),
    discordWebhookDiscoveryUrl:
      env("DISCORD_WEBHOOK_DISCOVERY_URL") || env("DISCORD_DISCOVERY_WEBHOOK_URL"),
    discordWebhookCheckUrl: env("DISCORD_WEBHOOK_CHECK_URL") || env("DISCORD_CHECK_WEBHOOK_URL"),
    discordWebhookExtractUrl:
      env("DISCORD_WEBHOOK_EXTRACT_URL") || env("DISCORD_EXTRACT_WEBHOOK_URL"),
    discordWebhookUrl: env("DISCORD_WEBHOOK_URL") || env("DISCORD_ADMIN_WEBHOOK_LOG_URL"),
    discordNotifyRoutine: env("DISCORD_NOTIFY_ROUTINE"),
    public: {
      siteUrl,
      supabaseUrl,
      // True when nitro.devProxy forwards /supabase to a real Supabase (dev only).
      devSupabaseProxy: Boolean(supabaseUrl),
      supabaseKey: supabasePublishableKey,
    },
  },

  supabase: {
    url: supabaseUrl,
    key: supabasePublishableKey,
    redirect: false,
    types: resolve(import.meta.dirname, "../../packages/database/src/database.types.ts"),
    cookieOptions: {
      sameSite: "lax",
      secure: isProduction,
    },
  },

  features: {
    // Nuxt links its entry stylesheet by default; inlining every stylesheet removes the
    // render-blocking request, and the HTML is cached at the edge so the extra bytes are paid once.
    inlineStyles: () => true,
  },

  experimental: {
    routeTypedFetch: true,
    defaults: {
      nuxtLink: {
        prefetchOn: {
          interaction: true,
          visibility: false,
        },
      },
    },
  },

  pwa: {
    registerType: "prompt",
    integration: {
      beforeBuildServiceWorker(options) {
        // Vite PWA adds manifest/icons after glob transforms; keep them available via HTTP only.
        options.workbox.additionalManifestEntries = [];
      },
    },
    client: {
      installPrompt: "dubbingbase:pwa-install-dismissed",
    },
    manifest: {
      id: "/",
      name: "DubbingBase",
      short_name: "DubbingBase",
      description: "The ultimate database for voice actors and dubbing projects.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      // A manifest cannot vary by color scheme, so use the dark theme's --app-color-background
      // (the default theme). app.vue overrides theme-color per scheme with meta tags.
      background_color: "#10131a",
      theme_color: "#10131a",
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
          purpose: "any",
        },
        {
          // Logo scaled into the maskable safe zone; "any maskable" on one icon is discouraged.
          src: "/android-chrome-maskable-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    workbox: {
      navigateFallback: null,
      // Cloudflare deployments can retire hashed chunks; keep app requests on the network.
      globPatterns: ["offline.html"],
      // Nuxt adds payload/build JSON globs. Keep only the offline document, with its exact URL.
      manifestTransforms: [
        (entries) => ({
          manifest: entries.filter((entry) => entry.url === "offline.html"),
          warnings: [],
        }),
      ],
    },
  },

  build: {
    // Inline the ESM build so unused icons are tree-shaken from the server bundle;
    // resolved externally, Nitro would bundle the 575 KB CommonJS build with every icon.
    transpile: ["lucide-vue-next"],
  },

  vite: {
    plugins: [tailwindcss()],
    // Dev server only: accept any Host (Tailscale/MagicDNS names, LAN hostnames) so the site is
    // reachable from every URL; no effect on production builds.
    server: { allowedHosts: true },
    define: {
      __VERSION__: JSON.stringify(appVersion),
    },
  },

  hooks: {
    // Dev, tests and typechecks run without Supabase credentials, but a production build must
    // never ship without them. `nuxt prepare` never builds Nitro.
    "nitro:build:before": (nitro) => {
      if (isProduction && !isE2E && (!supabaseUrl || !supabasePublishableKey)) {
        throw new Error(
          "Production builds require SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY; refusing to build without them.",
        );
      }
      // The client manifest is ready by this point and Nitro has yet to serialize its config.
      nitro.options.runtimeConfig.homepageStylesheet = entryStylesheet;
    },
    "build:manifest": (manifest) => {
      const entries = Object.values(manifest);
      entryStylesheet = entries.find((entry) => entry.isEntry && entry.css?.length)?.css?.[0] ?? "";

      // Keep module preloads for the current page and let other chunks load on demand.
      // Speculative SSR prefetches compete with the first render and can fail at the edge.
      for (const entry of entries) {
        entry.prefetch = false;
      }
    },
  },

  css: ["~/assets/main.css"],

  modules: [
    "@nuxt/fonts",
    "@nuxtjs/i18n",
    "@nuxtjs/supabase",
    "@nuxtjs/robots",
    "@nuxt/image",
    "@vite-pwa/nuxt",
    // Test and validation tooling is not needed in the production bundle.
    ...(isProduction ? [] : ["@nuxt/test-utils/module", "@nuxtjs/html-validator"]),
  ],

  fonts: {
    experimental: {
      processCSSVariables: true,
    },
    // Only Google (Inter) and local fonts are used. Disabling the other default providers stops
    // the build from fetching their catalogs, where a CDN timeout would fail the whole build.
    providers: {
      adobe: false,
      bunny: false,
      fontshare: false,
      fontsource: false,
      googleicons: false,
    },
    families: [{ name: "Inter", provider: "google", display: "swap", preload: true }],
  },

  site: {
    url: siteUrl,
    name: "DubbingBase",
  },

  robots: {
    sitemap: [`${siteUrl}/sitemap.xml`],
  },

  image: {
    domains: [
      "image.tmdb.org",
      "images.igdb.com",
      ...(supabaseUrl ? [new URL(supabaseUrl).host] : []),
    ],
    // Dev: Nuxt resolves storage keys to "/supabase/..." (see src/composables/useMediaImage.ts);
    // the image optimizer fetches them from the real Supabase URL.
    alias: supabaseUrl ? { "/supabase": supabaseUrl } : {},
    format: ["avif", "webp"],
  },

  i18n: {
    langDir: "locales",
    locales: APP_LOCALES.map((locale) => ({ ...locale })),
    defaultLocale: DEFAULT_LOCALE,
    strategy: "prefix_except_default",
    baseUrl: siteUrl,
    // No automatic redirect or server-side cookie: the URL decides the language
    // and LanguageBanner only suggests the visitor's preferred one, so HTML is
    // identical for every visitor and cacheable.
    detectBrowserLanguage: false,
  },

  srcDir: "src/",
});
