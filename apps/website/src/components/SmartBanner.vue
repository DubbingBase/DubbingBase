<template>
  <div
    v-if="!isDismissed && isMobile"
    class="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-[360px] flex items-center justify-between gap-3 bg-background/95 backdrop-blur-xl border border-border p-2 pl-3 rounded-full shadow-2xl transition-all duration-300"
  >
    <!-- Left Section: Logo & Text -->
    <div class="flex items-center gap-3 overflow-hidden">
      <!-- App Logo / Icon -->
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Icon name="lucide:smartphone" class="h-5 w-5 text-primary" />
      </div>

      <!-- App Info -->
      <div class="flex flex-col truncate pr-2">
        <span class="text-sm font-semibold leading-tight text-foreground truncate">DubbingBase</span>
        <span class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase truncate">Application Mobile</span>
      </div>
    </div>

    <!-- Right Section: Actions -->
    <div class="flex items-center gap-1.5 shrink-0 pr-1">
      <a :href="appLink" class="inline-flex items-center justify-center whitespace-nowrap rounded-full text-xs font-semibold transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-4 shadow-sm active:scale-95">
        Ouvrir
      </a>
      
      <!-- Close button -->
      <button @click="dismissBanner" aria-label="Close banner" class="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-secondary active:scale-95">
        <Icon name="lucide:x" class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">

import { useStorage, useWindowSize } from '@vueuse/core';

// Only show banner if not previously dismissed
const isDismissed = useStorage('dubbingbase-smart-banner-dismissed', false);

// Determine if we are on a mobile device (naive check based on window size, standard for md:hidden is < 768px)
const { width } = useWindowSize();
const isMobile = ref(false);

onMounted(() => {
  // We initialize on mount to avoid hydration mismatch between server and client
  isMobile.value = width.value < 768;
});

const route = useRoute();

// The standard universal link pointing to the exact same path
const appLink = computed(() => {
  // Fallback to home if no route is available
  const path = route.fullPath || '/';
  // Strip the leading slash
  const formattedPath = path.startsWith('/') ? path.substring(1) : path;
  
  // Use Android Intent URL format. 
  // - If the app is installed, it opens it via the custom scheme dubbingbase://
  // - If not installed, it falls back to the Play Store
  const fallbackUrl = encodeURIComponent('https://play.google.com/store/apps/details?id=com.dubbingbase.app&hl=fr');
  return `intent://${formattedPath}#Intent;scheme=dubbingbase;package=com.dubbingbase.app;S.browser_fallback_url=${fallbackUrl};end`;
});

const dismissBanner = () => {
  isDismissed.value = true;
};
</script>
