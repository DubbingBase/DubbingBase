<template>
  <div
    v-if="!isDismissed && isMobile"
    class="md:hidden flex items-center justify-between bg-background border-b px-4 py-3 shadow-sm"
  >
    <div class="flex items-center space-x-3">
      <!-- Close button -->
      <button @click="dismissBanner" class="p-1 text-muted-foreground hover:text-foreground">
        <Icon name="lucide:x" class="h-5 w-5" />
      </button>

      <!-- Generic App Logo Placeholder -->
      <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <Icon name="lucide:smartphone" class="h-6 w-6 text-primary" />
      </div>

      <!-- App Info -->
      <div class="flex flex-col">
        <span class="text-sm font-semibold leading-tight">DubbingBase</span>
        <span class="text-xs text-muted-foreground">Get the App</span>
      </div>
    </div>

    <!-- Action Button -->
    <a :href="appLink" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-gray-300 bg-gray-900 text-gray-50 hover:bg-gray-900/90 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-50/90 h-8 px-3">Open</a>
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
  // Standard universal link
  return `https://dubbingbase.com${path}`;
});

const dismissBanner = () => {
  isDismissed.value = true;
};
</script>
