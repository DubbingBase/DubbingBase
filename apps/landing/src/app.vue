<template>
  <div class="min-h-screen bg-white text-gray-900 dark:bg-[#121212] dark:text-white transition-colors duration-200">
    <NuxtLoadingIndicator color="#3B82F6" :height="3" />
    <SmartBanner />
    <Header />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <Footer />
  </div>
</template>

<script setup lang="ts">
useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} | DubbingBase` : 'DubbingBase - La base de données du doublage';
  },
  link: [
    { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    { rel: 'manifest', href: '/manifest.webmanifest' }
  ]
});
</script>
