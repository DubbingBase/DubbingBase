import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { defineNuxtConfig } from "nuxt/config";
import { APP_LOCALES, DEFAULT_LOCALE } from "@app/shared-logic";
import { gzipSync } from "node:zlib";

function env(name: string): string | undefined {
  return process.env[name] ?? process.env[`NUXT_${name}`];
}

const supabaseUrl = env("SUPABASE_URL") ?? env("PUBLIC_SUPABASE_URL");
const supabasePublishableKey = env("SUPABASE_PUBLISHABLE_KEY");
const ABOUT_PRERENDER_ROUTES = new Set(["/about", "/fr/about", "/es/about", "/ja/about"]);

type ClientOutputChunk = {
  type: "chunk";
  fileName: string;
  facadeModuleId: string | null;
  isEntry: boolean;
  imports: string[];
  code: string;
};

type ClientOutputItem = ClientOutputChunk | { type: "asset" };

function getPageRoute(source: string | null): string | undefined {
  if (!source) return undefined;

  const match = source.replaceAll("\\", "/").match(/(?:^|\/)pages\/(.+)$/);
  if (!match) return undefined;

  const firstSegment = match[1].split("/")[0];
  const route = firstSegment === "index.vue" ? "home" : firstSegment.replace(/\.vue$/, "");
  return route.startsWith("(") ? undefined : route;
}

function clientBundleBudgetPlugin() {
  return {
    name: "dubbingbase:client-bundle-budget",
    apply: "build" as const,
    enforce: "post" as const,
    writeBundle(outputOptions: { dir?: string }, bundle: Record<string, ClientOutputItem>) {
      const outputDirectory = outputOptions.dir?.replaceAll("\\", "/");
      if (!outputDirectory?.match(/(?:^|\/)\.nuxt\/dist\/client$/)) return;

      const chunks = Object.values(bundle).filter(
        (item): item is ClientOutputChunk => item.type === "chunk",
      );
      const chunksByFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
      const commonEntries = chunks.filter(
        (chunk) => chunk.isEntry && !getPageRoute(chunk.facadeModuleId),
      );
      const pages = new Map<string, ClientOutputChunk[]>();

      for (const chunk of chunks) {
        const route = getPageRoute(chunk.facadeModuleId);
        if (route) pages.set(route, [...(pages.get(route) ?? []), chunk]);
      }

      if (commonEntries.length === 0 || pages.size === 0) {
        throw new Error("Could not find common and page entries in the client bundle.");
      }

      const report = [...pages].map(([route, entries]) => {
        const visited = new Set<string>();
        const pending = [...commonEntries, ...entries].map((chunk) => chunk.fileName);

        while (pending.length > 0) {
          const fileName = pending.pop();
          if (!fileName || visited.has(fileName)) continue;
          visited.add(fileName);
          pending.push(...(chunksByFile.get(fileName)?.imports ?? []));
        }

        const routeChunks = [...visited]
          .map((fileName) => chunksByFile.get(fileName))
          .filter((chunk): chunk is ClientOutputChunk => chunk !== undefined);
        const size = routeChunks.reduce(
          (total, chunk) => {
            const contents = Buffer.from(chunk.code);
            return {
              rawBytes: total.rawBytes + contents.byteLength,
              gzipBytes: total.gzipBytes + gzipSync(contents).byteLength,
            };
          },
          { rawBytes: 0, gzipBytes: 0 },
        );

        return { route, ...size, chunkCount: routeChunks.length };
      });

      report.sort((left, right) => right.rawBytes - left.rawBytes);
      console.log("Client route JavaScript (static imports only; dynamic imports excluded):");
      for (const row of report) {
        console.log(
          `  ${row.route.padEnd(18)} ${`${row.rawBytes} B raw`.padStart(12)}  ` +
            `${`${row.gzipBytes} B gzip`.padStart(13)}  ${row.chunkCount} chunks`,
        );
      }

      const largestPublicPage = report.find(
        (row) => row.route !== "admin" && !row.route.startsWith("admin/"),
      );
      const maxPublicBytes = Number(process.env.PUBLIC_INITIAL_JS_BUDGET_BYTES ?? 900_000);

      if (!Number.isSafeInteger(maxPublicBytes) || maxPublicBytes <= 0) {
        throw new Error("PUBLIC_INITIAL_JS_BUDGET_BYTES must be a positive integer.");
      }
      if (!largestPublicPage)
        throw new Error("No public page chunks were found in the client bundle.");

      console.log(`Largest public route: ${largestPublicPage.route}`);
      console.log(`Public initial JavaScript budget: ${maxPublicBytes} B raw.`);
      if (largestPublicPage.rawBytes > maxPublicBytes) {
        throw new Error(
          `Public initial JavaScript budget exceeded: ${largestPublicPage.route} is ` +
            `${largestPublicPage.rawBytes} B; limit is ${maxPublicBytes} B.`,
        );
      }
    },
  };
}

function stripAboutClientRuntime(html: string): string {
  return (
    html
      .replace(
        /<link\b(?=[^>]*\brel=["'](?:modulepreload|prefetch)["'])(?=[^>]*\bhref=["']\/_nuxt\/)[^>]*>\s*/g,
        "",
      )
      .replace(
        /<link\b(?=[^>]*\brel=["']preload["'])(?=[^>]*\bas=["']fetch["'])(?=[^>]*\bhref=["'][^"']*_payload\.json)[^>]*>\s*/g,
        "",
      )
      // Nuxt Fonts 0.14 preloads an unused italic Cyrillic face on these pages.
      .replace(/<link\b(?=[^>]*\brel=["']preload["'])(?=[^>]*\bas=["']font["'])[^>]*>\s*/g, "")
      .replace(/<link\b(?=[^>]*\bhref=["']\/favicon\.ico["'])[^>]*>\s*/g, "")
      .replace(
        /<body\b/,
        `<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',` +
          'Roboto,Helvetica,Arial,sans-serif"',
      )
      .replace(/<script\b(?=[^>]*\btype=["']importmap["'])[^>]*>[\s\S]*?<\/script>\s*/g, "")
      .replace(
        /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["']\/_nuxt\/)[^>]*>\s*<\/script>\s*/g,
        "",
      )
      .replace(/<script\b(?=[^>]*\bid=["']__NUXT_DATA__["'])[^>]*>[\s\S]*?<\/script>\s*/g, "")
      .replace(/<script\b[^>]*>\s*window\.__NUXT_SITE_CONFIG__\s*=[\s\S]*?<\/script>\s*/g, "")
      .replace(/<script\b[^>]*>\s*window\.__NUXT__\s*=[\s\S]*?<\/script>\s*/g, "")
  );
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
    prerender: {
      routes: [...ABOUT_PRERENDER_ROUTES],
    },
    hooks: {
      "prerender:generate": (route) => {
        if (!ABOUT_PRERENDER_ROUTES.has(route.route) || !route.contents) return;
        route.contents = stripAboutClientRuntime(route.contents);
      },
    },
    experimental: {
      tasks: true,
    },
    scheduledTasks:
      process.env.E2E_TEST === "true"
        ? {}
        : {
            "* * * * *": ["dispatcher"],
            "0 6 * * *": ["enqueue-trending-media"],
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
      env("DISCORD_WEBHOOK_DISCOVERY_URL") || env("DISCORD_DISCOVERY_WEBHOOK_URL"),
    discordWebhookCheckUrl: env("DISCORD_WEBHOOK_CHECK_URL") || env("DISCORD_CHECK_WEBHOOK_URL"),
    discordWebhookExtractUrl:
      env("DISCORD_WEBHOOK_EXTRACT_URL") || env("DISCORD_EXTRACT_WEBHOOK_URL"),
    discordWebhookUrl: env("DISCORD_WEBHOOK_URL") || env("DISCORD_ADMIN_WEBHOOK_LOG_URL"),
    resendApiKey: env("RESEND_API_KEY"),
    resendFromEmail: env("RESEND_FROM_EMAIL"),
    resendToEmail: env("RESEND_TO_EMAIL"),
    adminEmail: env("ADMIN_EMAIL"),
    public: {
      // Temporarily enable actor-specific previews with NUXT_PUBLIC_OG_IMAGES_ENABLED=true.
      ogImagesEnabled: false,
      supabaseUrl: supabaseUrl || "https://mock.supabase.co",
      supabaseKey: supabasePublishableKey || "mock-publishable-key",
    },
  },

  supabase: {
    url: supabaseUrl || "https://mock.supabase.co",
    key: supabasePublishableKey || "mock-publishable-key",
    redirect: false,
    types: resolve(import.meta.dirname, "../../packages/database/src/database.types.ts"),
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
      description: "The ultimate database for voice actors and dubbing projects.",
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

  vite: {
    plugins: [tailwindcss(), clientBundleBudgetPlugin()],
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
    "@nuxt/test-utils/module",
    "@nuxtjs/html-validator",
  ],

  // @ts-ignore
  fonts: {
    experimental: {
      processCSSVariables: true,
    },
    families: [{ name: "Inter", provider: "google", display: "block", preload: true }],
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
    locales: APP_LOCALES.map((locale) => ({ ...locale })),
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
});
