<template>
  <div class="min-h-screen theme-bg theme-text transition-colors duration-200">
    <NuxtLoadingIndicator color="#3B82F6" :height="3" />
    <ClientOnly>
      <PwaLifecycleBanner />
    </ClientOnly>
    <LanguageBanner />
    <Header />
    <main>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </main>
    <Footer />
  </div>
</template>

<script setup lang="ts">
import { APP_LOCALES } from "@app/shared-logic";

const { effectiveTheme } = useTheme();
// Applies the saved theme (cookie, falling back to the OS preference) before
// first paint, because server-rendered HTML always uses the dark default.
const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )dubbingbase-theme=([^;]*)/);var t=m?decodeURIComponent(m[1]).replace(/"/g,""):"system";if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
const MAX_TITLE_LENGTH = 70;
const route = useRoute();
const isAdminRoute = computed(() => {
  const middleware = route.meta.middleware;
  return middleware === "admin" || (Array.isArray(middleware) && middleware.includes("admin"));
});
const i18nHead = useLocaleHead({
  dir: true,
  seo: true,
});
const regionalLanguages = new Set(APP_LOCALES.map((supportedLocale) => supportedLocale.language));
const localeHeadLinks = computed(() =>
  (i18nHead.value.link || []).filter(
    (headLink) => !("hreflang" in headLink) || regionalLanguages.has(headLink.hreflang),
  ),
);
const canonicalUrl = computed(
  () => i18nHead.value.link?.find((headLink) => headLink.rel === "canonical")?.href,
);
const defaultLocaleUrl = computed(
  () =>
    i18nHead.value.link?.find((headLink) => "hreflang" in headLink && headLink.hreflang === "en-US")
      ?.href,
);

useHead(() => ({
  script: [{ key: "theme-init", innerHTML: THEME_INIT_SCRIPT }],
  htmlAttrs: {
    "data-theme": effectiveTheme.value,
    lang: i18nHead.value.htmlAttrs?.lang || "en",
    dir: i18nHead.value.htmlAttrs?.dir || "ltr",
  },
  titleTemplate: (titleChunk) => {
    const title = titleChunk ? `${titleChunk} | DubbingBase` : "DubbingBase";
    // Search engines truncate long titles; keep them within html-validate's limit.
    return title.length > MAX_TITLE_LENGTH ? `${title.slice(0, MAX_TITLE_LENGTH - 1)}…` : title;
  },
  link: [
    { rel: "manifest", href: "/manifest.webmanifest" },
    {
      rel: "icon",
      type: "image/png",
      href: "/favicon-96x96.png",
      sizes: "96x96",
    },
    {
      rel: "icon",
      type: "image/png",
      href: "/android-chrome-192x192.png",
      sizes: "192x192",
    },
    { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
    { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ...localeHeadLinks.value,
    ...(defaultLocaleUrl.value
      ? [
          {
            rel: "alternate" as const,
            hreflang: "x-default",
            href: defaultLocaleUrl.value,
          },
        ]
      : []),
  ],
  meta: [
    {
      name: "theme-color",
      content: "#10131a",
      media: "(prefers-color-scheme: dark)",
    },
    {
      name: "theme-color",
      content: "#f8fafc",
      media: "(prefers-color-scheme: light)",
    },
    ...(isAdminRoute.value ? [{ name: "robots", content: "noindex, nofollow" }] : []),
    ...(i18nHead.value.meta || []),
    ...(!isAdminRoute.value && canonicalUrl.value
      ? [
          { property: "og:url", content: canonicalUrl.value },
          { name: "twitter:url", content: canonicalUrl.value },
        ]
      : []),
  ],
}));

useSeoMeta({
  ogSiteName: "DubbingBase",
});
</script>
