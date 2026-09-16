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
        <NuxtPage :keepalive="{ max: 10 }" />
      </NuxtLayout>
    </main>
    <Footer />
  </div>
</template>

<script setup lang="ts">
const { effectiveTheme } = useTheme();
const i18nHead = useLocaleHead({
  dir: true,
  seo: true,
});

useHead({
  htmlAttrs: {
    "data-theme": effectiveTheme,
    lang: () => i18nHead.value.htmlAttrs?.lang || "en",
    dir: () => i18nHead.value.htmlAttrs?.dir || "ltr",
  },
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} | DubbingBase` : "DubbingBase";
  },
  link: [
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
    ...(i18nHead.value.link || []),
  ],
  meta: () => [
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
    ...(i18nHead.value.meta || []),
  ],
});

useSeoMeta({
  ogSiteName: "DubbingBase",
});
</script>
