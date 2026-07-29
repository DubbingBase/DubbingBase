<template>
  <div v-if="isMobile && isVisible" class="fixed bottom-0 left-0 right-0 z-50 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-gray-800 border-t border-gray-700 flex justify-between items-center shadow-lg">
    <div class="flex flex-col">
      <span class="text-white font-bold text-sm">{{ t('app.title') }} App</span>
      <span class="text-gray-400 text-xs">Better experience on mobile</span>
    </div>

    <div class="flex items-center gap-3">
      <a
        :href="appLink"
        class="bg-white text-gray-900 hover:bg-gray-200 px-4 py-2 rounded-md font-semibold text-sm transition-colors"
      >
        Open in App
      </a>

      <button
        @click="closeBanner"
        class="text-gray-400 hover:text-white p-1"
        aria-label="Close"
      >
        <XIcon class="w-5 h-5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from '../composables/useI18n';
import { XIcon } from 'lucide-vue-next';

const { t } = useI18n();

const isMobile = ref(false);
const isVisible = ref(true);
const appLink = ref('dubbingbase://');

// Simple mobile detection based on User Agent
const checkMobile = () => {
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

  // Basic Regex to detect mobile devices
  if (/android/i.test(userAgent)) {
    isMobile.value = true;
  } else if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
    isMobile.value = true;
  } else if (window.innerWidth <= 768) {
    // Fallback based on screen width
    isMobile.value = true;
  }
};

const closeBanner = () => {
  isVisible.value = false;
  // Optional: save preference to localStorage so it doesn't show again immediately
  localStorage.setItem('hideAppBanner', 'true');
};

onMounted(() => {
  // Check if user previously closed it
  const hidden = localStorage.getItem('hideAppBanner');
  if (hidden === 'true') {
    isVisible.value = false;
  } else {
    checkMobile();
  }

  // Try to append current path to deep link
  if (typeof window !== 'undefined') {
    // This allows linking directly to current page in app
    appLink.value = `dubbingbase://${window.location.pathname.replace(/^\//, '')}`;
  }
});
</script>
