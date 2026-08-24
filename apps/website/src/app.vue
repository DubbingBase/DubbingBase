<template>
  <div class="min-h-screen bg-white text-gray-900 dark:bg-[#121212] dark:text-white transition-colors duration-200">
    <NuxtLoadingIndicator color="#3B82F6" :height="3" />
    <SmartBanner />
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
  seo: true
})

useHead({
  htmlAttrs: {
    'data-theme': effectiveTheme,
    lang: () => i18nHead.value.htmlAttrs?.lang || 'en',
    dir: () => i18nHead.value.htmlAttrs?.dir || 'ltr'
  },
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} | DubbingBase` : 'DubbingBase';
  },
  link: [
    { rel: 'icon', type: 'image/png', href: '/favicon-96x96.png', sizes: '96x96' },
    { rel: 'icon', type: 'image/png', href: '/android-chrome-192x192.png', sizes: '192x192' },
    { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    { rel: 'manifest', href: '/manifest.webmanifest' },
    ...(i18nHead.value.link || [])
  ],
  meta: () => [...(i18nHead.value.meta || [])]
});

useSeoMeta({
  ogSiteName: 'DubbingBase'
});
</script>
